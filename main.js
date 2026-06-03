// ─────────────────────────────────────────────────────────────────────────────
// Language Mapping Layer
// ─────────────────────────────────────────────────────────────────────────────
function getLanguageName(ext) {
   const mapping = {
      'rs': 'rust', 'gd': 'godotscript', 'lua': 'lua', 'cs': 'csharp',
      'py': 'python', 'js': 'javascript', 'ts': 'typescript', 'cpp': 'cpp',
      'cc': 'cpp', 'cxx': 'cpp', 'hpp': 'cpp', 'h': 'cpp', 'c': 'c',
      'go': 'go', 'rb': 'ruby', 'fs': 'fsharp', 'fsi': 'fsharp', 'fsx': 'fsharp',
      'java': 'java', 'kt': 'kotlin', 'swift': 'swift', 'tscn': 'godot-data',
      'tres': 'godot-data', 'godot': 'godot-data', 'gdshader': 'godot-shader',
      'unity': 'unity-data', 'prefab': 'unity-data', 'meta': 'unity-data',
      'mat': 'unity-data', 'uproject': 'unreal-data', 'uasset': 'unreal-data',
      'umap': 'unreal-data', 'glsl': 'glsl', 'vert': 'glsl', 'frag': 'glsl',
      'comp': 'glsl', 'geom': 'glsl', 'hlsl': 'hlsl', 'fx': 'hlsl',
      'hlsli': 'hlsl', 'wgsl': 'wgsl', 'makefile': 'makefile', 'make': 'makefile',
      'mk': 'makefile', 'dockerfile': 'dockerfile', 'dockerignore': 'dockerfile',
      'env': 'dotenv', 'lock': 'lockfile', 'cmake': 'cmake', 'sh': 'shell',
      'bash': 'shell', 'ps1': 'powershell', 'psm1': 'powershell', 'psd1': 'powershell',
      'bat': 'batch', 'cmd': 'batch', 'toml': 'toml', 'json': 'json',
      'yaml': 'yaml', 'yml': 'yaml', 'xml': 'xml', 'csproj': 'xml',
      'fsproj': 'xml', 'ini': 'ini', 'cfg': 'ini', 'prefs': 'ini',
      'csv': 'csv', 'md': 'markdown', 'markdown': 'markdown', 'txt': 'text',
      'html': 'html', 'htm': 'html', 'css': 'css', 'sql': 'sql'
   };
   return mapping[ext.toLowerCase()] || 'text';
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM References
// ─────────────────────────────────────────────────────────────────────────────
const selectDirBtn       = document.getElementById('select-dir-btn');
const extensionsInput    = document.getElementById('extensions-input');
const ignoreInput        = document.getElementById('ignore-input');
const loadGitignoreBtn   = document.getElementById('load-gitignore-btn');
const outputText         = document.getElementById('output-text');
const copyBtn            = document.getElementById('copy-btn');
const downloadBtn        = document.getElementById('download-btn');
const statusDiv          = document.getElementById('status');
const statsSpan          = document.getElementById('stats');
const compatBanner       = document.getElementById('compat-banner');
const compatMessage      = document.getElementById('compat-message');

let fileCount = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Ignore Pattern Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * parseIgnorePatterns: Converts a raw string of space/comma-separated tokens
 * (or newline-separated .gitignore text) into a clean array of pattern strings.
 *
 * Handles:
 *  - .gitignore comment lines (# ...)
 *  - Negation lines (!) – noted but not applied; they're stripped for safety
 *  - Trailing slashes (dir/ → dir) since we match by name/path segment
 *  - Glob wildcards are supported via matchesIgnorePattern below
 */
function parseIgnorePatterns(rawText) {
   return rawText
      .split(/[\s,]+/)              // split on whitespace or commas
      .map(p => p.trim())
      .filter(p => p.length > 0 && !p.startsWith('#') && !p.startsWith('!'))
      .map(p => p.replace(/\/$/, '')); // strip trailing slash
}

/**
 * matchesIgnorePattern: Tests whether a file/directory name (or relative path)
 * matches a single ignore pattern.
 *
 * Supports:
 *  - Exact name match:         "dist"       → matches any entry named "dist"
 *  - Simple glob:              "*.log"      → matches "app.log"
 *  - Path prefix match:        "build/tmp"  → matches path segment "build/tmp"
 *  - Double-star glob (**):    "src/**"     → matches everything under src/
 *
 * @param {string} pattern   - Single pattern token (no trailing slash)
 * @param {string} entryName - The bare name of the file/directory
 * @param {string} relPath   - The relative path from the root, e.g. "src/utils"
 */
function matchesIgnorePattern(pattern, entryName, relPath) {
   // Convert the gitignore-style glob into a RegExp.
   // We escape regex special chars except * and ?.
   const toRegex = (glob) => {
      let reStr = glob
         .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex specials
         .replace(/\*\*/g, '§§DOUBLESTAR§§')    // protect **
         .replace(/\*/g, '[^/]*')               // * → any chars except /
         .replace(/§§DOUBLESTAR§§/g, '.*')      // ** → any chars including /
         .replace(/\?/g, '[^/]');               // ? → single non-slash char
      return new RegExp(`^${reStr}$`, 'i');
   };

   const nameRe  = toRegex(pattern);
   // Test bare name first (covers "node_modules", "*.log", ".git", etc.)
   if (nameRe.test(entryName)) return true;

   // If the pattern contains a slash it is path-relative; test the full relPath.
   if (pattern.includes('/')) {
      const pathRe = toRegex(pattern);
      if (pathRe.test(relPath)) return true;
   }

   return false;
}

/**
 * shouldIgnore: Returns true if an entry should be skipped.
 *
 * @param {string}   entryName    - Bare file/dir name
 * @param {string}   relPath      - Relative path from root
 * @param {string[]} ignoreList   - Parsed array of patterns
 */
function shouldIgnore(entryName, relPath, ignoreList) {
   return ignoreList.some(pattern => matchesIgnorePattern(pattern, entryName, relPath));
}

/**
 * getActiveIgnoreList: Reads the ignore input field and returns the parsed array.
 * Called fresh on each directory scan so in-between edits are picked up.
 */
function getActiveIgnoreList() {
   return parseIgnorePatterns(ignoreInput.value);
}

// ─────────────────────────────────────────────────────────────────────────────
// .gitignore Loader
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prompts the user to pick a .gitignore file, parses its contents, and merges
 * the resulting patterns into the ignore input field (deduplicating).
 */
loadGitignoreBtn.addEventListener('click', async () => {
   try {
      // Open a file picker filtered to .gitignore files (and plain text as fallback)
      const [fileHandle] = await window.showOpenFilePicker({
         types: [{
            description: '.gitignore files',
            accept: { 'text/plain': ['.gitignore', '.txt'] }
         }],
         multiple: false
      });

      const file    = await fileHandle.getFile();
      const rawText = await file.text();

      // Parse .gitignore: newline-separated, supports comments and blanks
      const newPatterns = rawText
         .split('\n')
         .map(l => l.trim())
         .filter(l => l.length > 0 && !l.startsWith('#') && !l.startsWith('!'))
         .map(l => l.replace(/\/$/, '')); // strip trailing slashes

      if (newPatterns.length === 0) {
         statusDiv.textContent = 'Loaded .gitignore — no actionable patterns found.';
         return;
      }

      // Merge with existing patterns (deduplicate)
      const existing    = parseIgnorePatterns(ignoreInput.value);
      const merged      = Array.from(new Set([...existing, ...newPatterns]));
      ignoreInput.value = merged.join(' ');

      statusDiv.textContent = `Loaded .gitignore: merged ${newPatterns.length} pattern(s). Total active: ${merged.length}.`;
   } catch (err) {
      if (err.name !== 'AbortError') {
         statusDiv.textContent = `Error loading .gitignore: ${err.message}`;
         console.error(err);
      }
      // User cancelled — silently ignore
   }
});

// ─────────────────────────────────────────────────────────────────────────────
// Environment Check Verification Layer
// ─────────────────────────────────────────────────────────────────────────────
function verifyEnvironment() {
   const hasAPI     = 'showDirectoryPicker' in window;
   const isLocalFile = window.location.protocol === 'file:';

   if (!hasAPI || isLocalFile) {
      compatBanner.style.display = 'block';
      selectDirBtn.disabled      = true;
      loadGitignoreBtn.disabled  = true;

      if (isLocalFile) {
         compatMessage.innerHTML = 'Security restrictions prohibit execution via the <code>file://</code> protocol.';
         statusDiv.textContent   = 'Status: Serve via HTTP localhost to enable.';
      } else {
         compatMessage.innerHTML = 'Your active browser configuration lacks <code>showDirectoryPicker</code> support.';
         statusDiv.textContent   = 'Status: Incompatible runtime architecture.';
      }
      return false;
   }
   return true;
}

// Initialize Guard
verifyEnvironment();

// ─────────────────────────────────────────────────────────────────────────────
// Main Directory Processing Entry Point
// ─────────────────────────────────────────────────────────────────────────────
selectDirBtn.addEventListener('click', async () => {
   try {
      const dirHandle = await window.showDirectoryPicker();
      statusDiv.textContent = `Processing directory: ${dirHandle.name}...`;
      fileCount = 0;

      // Snapshot the ignore list at scan-start so mid-scan edits don't affect results
      const ignoreList = getActiveIgnoreList();

      let rawInputValue    = extensionsInput.value.trim().toLowerCase();
      let allowedExtensions = [];
      let isAllMode        = rawInputValue === 'all' || rawInputValue === '*';

      if (isAllMode) {
         statusDiv.textContent = `Analyzing directory structure to discover valid source extensions...`;
         const discoveredExtensions = new Set();
         await harvestExtensions(dirHandle, discoveredExtensions, ignoreList);
         allowedExtensions = Array.from(discoveredExtensions);
         statusDiv.textContent = `Discovered ${allowedExtensions.length} language targets: [${allowedExtensions.join(', ')}]`;
      } else {
         allowedExtensions = rawInputValue
            .split(/\s+/)
            .map(ext => ext.replace(/^\./, '').toLowerCase());
      }

      if (allowedExtensions.length === 0) {
         statusDiv.textContent = `Aborted: No parseable extensions identified in target directory.`;
         return;
      }

      // 1. Structural visual tree traversal map
      const treeLines = [dirHandle.name];
      await buildTreeStructure(dirHandle, '', treeLines, allowedExtensions, ignoreList, dirHandle.name);

      let finalOutput = `<begin tree>\n${treeLines.join('\n')}\n<end tree>\n\n`;

      // 2. Data aggregation pass
      const bodyParts = [];
      await aggregateContents(dirHandle, dirHandle.name, allowedExtensions, bodyParts, ignoreList);

      finalOutput += bodyParts.join('\n');
      outputText.value = finalOutput;

      statusDiv.textContent = `Successfully processed directory: ${dirHandle.name}`;
      const sizeKb = (new Blob([finalOutput]).size / 1024).toFixed(1);
      statsSpan.textContent = `Files: ${fileCount} // Size: ${sizeKb} KB`;

      copyBtn.disabled     = false;
      downloadBtn.disabled = false;
   } catch (err) {
      if (err.name !== 'AbortError') {
         statusDiv.textContent = `Error: ${err.message}`;
         console.error(err);
      } else {
         statusDiv.textContent = 'Directory targeting canceled by operator.';
      }
   }
});

// ─────────────────────────────────────────────────────────────────────────────
// Discovery Layer: Maps valid schema targets via fast folder evaluation pass.
// Now accepts ignoreList to skip excluded directories/files.
// ─────────────────────────────────────────────────────────────────────────────
async function harvestExtensions(dirHandle, extensionSet, ignoreList, relPath = '') {
   for await (const entry of dirHandle.values()) {
      const entryRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;

      // Skip entries matching any ignore pattern
      if (shouldIgnore(entry.name, entryRelPath, ignoreList)) continue;

      if (entry.kind === 'directory') {
         await harvestExtensions(entry, extensionSet, ignoreList, entryRelPath);
      } else if (entry.kind === 'file') {
         if (entry.name.includes('.')) {
            const ext = entry.name.split('.').pop().toLowerCase();
            if (getLanguageName(ext) !== 'text') {
               extensionSet.add(ext);
            }
         }
      }
   }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tree Traversal: Generates directory mapping tree, skipping ignored entries.
// ─────────────────────────────────────────────────────────────────────────────
async function buildTreeStructure(dirHandle, prefix, lines, allowedExtensions, ignoreList, relPath) {
   const entries = [];
   for await (const entry of dirHandle.values()) {
      const entryRelPath = `${relPath}/${entry.name}`;
      // Skip ignored entries before even adding to the list
      if (shouldIgnore(entry.name, entryRelPath, ignoreList)) continue;
      entries.push({ entry, entryRelPath });
   }

   // Sort: directories first, then alphabetically
   entries.sort((a, b) => {
      if (a.entry.kind !== b.entry.kind) return a.entry.kind === 'directory' ? -1 : 1;
      return a.entry.name.localeCompare(b.entry.name);
   });

   let directoryHasValidContents = false;

   for (let i = 0; i < entries.length; i++) {
      const { entry, entryRelPath } = entries[i];
      const isLast  = i === entries.length - 1;
      const pointer = isLast ? '└── ' : '├── ';

      if (entry.kind === 'file') {
         const ext = entry.name.includes('.') ? entry.name.split('.').pop().toLowerCase() : '';
         if (allowedExtensions.includes(ext)) {
            lines.push(`${prefix}${pointer}${entry.name}`);
            directoryHasValidContents = true;
         }
      } else if (entry.kind === 'directory') {
         const subtreeLines = [];
         const newPrefix    = prefix + (isLast ? '    ' : '│   ');

         const subtreeIsValid = await buildTreeStructure(
            entry, newPrefix, subtreeLines, allowedExtensions, ignoreList, entryRelPath
         );

         if (subtreeIsValid) {
            lines.push(`${prefix}${pointer}${entry.name}`);
            lines.push(...subtreeLines);
            directoryHasValidContents = true;
         }
      }
   }
   return directoryHasValidContents;
}

// ─────────────────────────────────────────────────────────────────────────────
// Universal Structural Reduction Layer (signatures mode, unchanged logic)
// ─────────────────────────────────────────────────────────────────────────────
function stripToSignatures(content, ext) {
   const normalizedExt = ext.toLowerCase();
   const lines         = content.split('\n');

   // Minified Asset Verification Layer
   const avgLineLength = content.length / (lines.length || 1);
   if (avgLineLength > 220 && lines.length < 5) {
      return `// [System Alert: Minified or single-line codebase detected. Fallback signature strategy initiated.]\n${content.substring(0, 500)}... [Truncated due to token limits]`;
   }

   // Strategy Routing Hub
   if (normalizedExt === 'json')                                          return extractJsonSkeleton(lines);
   if (normalizedExt === 'css')                                           return extractCssStructure(lines);
   if (['html', 'xml', 'tscn', 'tres', 'svg'].includes(normalizedExt))   return extractMarkupSkeleton(lines);
   if (['gd', 'py', 'yaml', 'yml'].includes(normalizedExt))              return extractIndentedSignatures(lines);
   if (normalizedExt === 'sql')                                           return extractSqlSchema(lines);

   return extractBracedSignatures(lines);
}

/**
 * Boundary Guard: First 5 + Last 5 lines context mapping
 */
function getSmarterFallback(lines) {
   if (lines.length <= 10) return lines.join('\n');
   return lines.slice(0, 5).join('\n') +
          '\n// ... [middle execution block omitted to preserve window attention]\n' +
          lines.slice(-5).join('\n');
}

/**
 * Strategy: Brace-delimited languages (JS, TS, Rust, C, C++, Java, Go, etc.)
 */
function extractBracedSignatures(lines) {
   let output       = [];
   let braceDepth   = 0;
   let inBlockComment = false;

   for (let line of lines) {
      let trimmed = line.trim();

      // Block comment tracking
      if (trimmed.startsWith('/*')) inBlockComment = true;
      if (inBlockComment) {
         if (trimmed.includes('*/')) inBlockComment = false;
         continue;
      }

      // Single-line comment pass-through for decorators / annotations
      if (trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

      const opens  = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;

      // At depth 0 every line is a top-level declaration candidate
      if (braceDepth === 0) {
         if (trimmed.length > 0) output.push(line);
      } else if (braceDepth === 1) {
         // One level deep: keep function/method signatures
         const isSignature = /^\s*(public|private|protected|static|async|function|def|fn |func |class |interface |struct |enum |const |let |var |export |import |type |@)/.test(line);
         if (isSignature || trimmed === '{' || trimmed === '}') output.push(line);
      }
      // Depths > 1: body omitted (reduces token bulk)

      braceDepth += opens - closes;
      if (braceDepth < 0) braceDepth = 0;
   }

   return output.length > 0 ? output.join('\n') : getSmarterFallback(lines);
}

/**
 * Strategy: Python / GDScript / YAML — indentation-driven signature extraction
 */
function extractIndentedSignatures(lines) {
   let output = [];
   for (let line of lines) {
      let trimmed = line.trim();
      // Keep only top-level definitions and class/function headers
      const isTopLevel = /^(def |class |func |fn |async def |@|import |from |export |#)/.test(trimmed);
      const isIndentedDef = /^\s+(def |class |func |fn |async def )/.test(line);
      if (isTopLevel || isIndentedDef || trimmed === '') output.push(line);
   }
   return output.length > 0 ? output.join('\n') : getSmarterFallback(lines);
}

/**
 * Strategy: HTML/XML structural skeleton
 */
function extractMarkupSkeleton(lines) {
   let output = [];
   for (let line of lines) {
      let trimmed = line.trim();
      if (trimmed.startsWith('<') || trimmed.endsWith('>')) {
         let processedLine = line;
         if (processedLine.length > 100 && processedLine.includes('=')) {
            processedLine = processedLine.replace(/([a-zA-Z0-9-]+)="([^"]{40,})"/g, '$1="..."');
         }
         if (processedLine.includes('>') && processedLine.includes('</') && processedLine.length > 120) {
            const openTag  = processedLine.substring(0, processedLine.indexOf('>') + 1);
            const closeTag = processedLine.substring(processedLine.lastIndexOf('</'));
            processedLine  = processedLine.replace(trimmed, `${openTag}...${closeTag}`);
         }
         output.push(processedLine);
      }
   }
   return output.length > 0 ? output.join('\n') : '';
}

/**
 * Strategy: JSON structural skeleton
 */
function extractJsonSkeleton(lines) {
   let output = [];
   for (let i = 0; i < lines.length; i++) {
      let line    = lines[i];
      let trimmed = line.trim();

      if (output.length > 100) {
         output.push('  // ... [Massive JSON data payload truncated to preserve context schema]');
         output.push(...lines.slice(-3));
         break;
      }

      if (trimmed === '{' || trimmed === '}' || trimmed === '[' || trimmed === ']' || trimmed === '},' || trimmed === '],') {
         output.push(line);
         continue;
      }

      const keyMatch = line.match(/^(\s*)"([^"]+)"\s*:\s*(.*)$/);
      if (keyMatch) {
         const indent = keyMatch[1];
         const key    = keyMatch[2];
         const value  = keyMatch[3].trim();
         if (value.startsWith('{') || value.startsWith('[')) {
            output.push(line);
         } else {
            const endsWithComma = value.endsWith(',') ? ',' : '';
            output.push(`${indent}"${key}": ...${endsWithComma}`);
         }
      }
   }
   return output.length > 0 ? output.join('\n') : '{\n  // ... [empty or unparseable JSON structural layer]\n}';
}

/**
 * Strategy: CSS selectors & property reduction
 */
function extractCssStructure(lines) {
   let output = [];
   for (let line of lines) {
      let trimmed = line.trim();
      if (trimmed.startsWith('@') || trimmed === '{' || trimmed === '}' || trimmed.endsWith('{') || trimmed.endsWith('}')) {
         output.push(line);
         continue;
      }
      if (trimmed.includes(':') && trimmed.endsWith(';')) {
         const parts    = line.split(':');
         const property = parts[0];
         output.push(`${property}: ...;`);
      }
   }
   return output.length > 0 ? output.join('\n') : '/* ... [CSS ruleset definitions omitted] */';
}

/**
 * Strategy: SQL schema filter (DDL only, strips DML data rows)
 */
function extractSqlSchema(lines) {
   let output         = [];
   const schemaPattern = /^(CREATE|ALTER|DROP|TABLE|VIEW|INDEX|PRIMARY KEY|FOREIGN KEY|CONSTRAINT)/i;
   const ignorePattern = /^(INSERT INTO|COPY|VALUES)/i;

   for (let line of lines) {
      let trimmed = line.trim();
      if (ignorePattern.test(trimmed)) continue;
      if (schemaPattern.test(trimmed) || trimmed === '(' || trimmed === ');' || trimmed.endsWith(',')) {
         output.push(line);
      }
   }
   return output.length > 0 ? output.join('\n') : '-- ... [SQL Schema omitted]';
}

// ─────────────────────────────────────────────────────────────────────────────
// Master Data Assembly Layer
// Now accepts ignoreList and threads it through recursive traversal.
// ─────────────────────────────────────────────────────────────────────────────
async function aggregateContents(dirHandle, currentPath, allowedExtensions, bodyParts, ignoreList) {
   for await (const entry of dirHandle.values()) {
      const entryRelativePath = `${currentPath}/${entry.name}`;

      // Skip entries matching any ignore pattern
      if (shouldIgnore(entry.name, entryRelativePath, ignoreList)) continue;

      if (entry.kind === 'directory') {
         await aggregateContents(entry, entryRelativePath, allowedExtensions, bodyParts, ignoreList);
      } else if (entry.kind === 'file') {
         const ext = entry.name.includes('.') ? entry.name.split('.').pop().toLowerCase() : '';

         if (allowedExtensions.includes(ext)) {
            try {
               const file = await entry.getFile();

               // Size threshold guard: skip files > 1 MB
               if (file.size > 1048576) {
                  const sizeMb  = (file.size / 1024 / 1024).toFixed(2);
                  const fileBlock = `<file path="${entryRelativePath}" language="text">\n` +
                                    `// [System Alert: File exceeds 1MB threshold (${sizeMb} MB). Excluded to prevent context flood.]\n` +
                                    `</file>\n`;
                  bodyParts.push(fileBlock);
                  fileCount++;
                  continue;
               }

               let content          = await file.text();
               const lang           = getLanguageName(ext);
               const originalSize   = (file.size / 1024).toFixed(2);
               const originalLines  = content.split('\n').length;

               if (document.getElementById('mode-toggle').checked) {
                  content = stripToSignatures(content, ext);
               }

               const fileBlock = `<file path="${entryRelativePath}" language="${lang}">\n` +
                                 `// Metrics: Extracted from ${originalSize} KB source | Original Line Count: ${originalLines}\n` +
                                 `${content}\n` +
                                 `</file>\n`;

               bodyParts.push(fileBlock);
               fileCount++;
            } catch (e) {
               console.warn(`Could not read file at ${entryRelativePath}:`, e);
            }
         }
      }
   }
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy & Download Handlers
// ─────────────────────────────────────────────────────────────────────────────
copyBtn.addEventListener('click', () => {
   navigator.clipboard.writeText(outputText.value);
   const original = copyBtn.textContent;
   copyBtn.textContent = 'Copied!';
   setTimeout(() => copyBtn.textContent = original, 1500);
});

downloadBtn.addEventListener('click', async () => {
   const filenameInput = document.getElementById('filename-input');
   const fileName      = filenameInput.value.trim() || 'context.txt';

   try {
      const handle = await window.showSaveFilePicker({
         suggestedName: fileName,
         types: [{ description: 'Text file', accept: { 'text/plain': ['.txt'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(outputText.value);
      await writable.close();
   } catch (err) {
      if (err.name !== 'AbortError') {
         console.error('File save failed:', err);
      }
   }
});
