// Language Mapping Layer
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

const selectDirBtn = document.getElementById('select-dir-btn');
const extensionsInput = document.getElementById('extensions-input');
const outputText = document.getElementById('output-text');
const copyBtn = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');
const statusDiv = document.getElementById('status');
const statsSpan = document.getElementById('stats');
const compatBanner = document.getElementById('compat-banner');
const compatMessage = document.getElementById('compat-message');

let fileCount = 0;

// Environment Check Verification Layer
function verifyEnvironment() {
   const hasAPI = 'showDirectoryPicker' in window;
   const isLocalFile = window.location.protocol === 'file:';

   if (!hasAPI || isLocalFile) {
      compatBanner.style.display = 'block';
      selectDirBtn.disabled = true;

      if (isLocalFile) {
         compatMessage.innerHTML = 'Security restrictions prohibit execution via the <code>file://</code> protocol.';
         statusDiv.textContent = 'Status: Serve via HTTP localhost to enable.';
      } else {
         compatMessage.innerHTML = 'Your active browser configuration lacks <code>showDirectoryPicker</code> support.';
         statusDiv.textContent = 'Status: Incompatible runtime architecture.';
      }
      return false;
   }
   return true;
}

// Initialize Guard
verifyEnvironment();

selectDirBtn.addEventListener('click', async () => {
   try {
      const dirHandle = await window.showDirectoryPicker();
      statusDiv.textContent = `Processing directory: ${dirHandle.name}...`;
      fileCount = 0;

      let rawInputValue = extensionsInput.value.trim().toLowerCase();
      let allowedExtensions = [];
      let isAllMode = rawInputValue === 'all' || rawInputValue === '*';

      if (isAllMode) {
         statusDiv.textContent = `Analyzing directory structure to discover valid source extensions...`;
         const discoveredExtensions = new Set();
         await harvestExtensions(dirHandle, discoveredExtensions);
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
      await buildTreeStructure(dirHandle, "", treeLines, allowedExtensions);

      let finalOutput = `<begin tree>\n${treeLines.join('\n')}\n<end tree>\n\n`;

      // 2. Data aggregation pass
      const bodyParts = [];
      await aggregateContents(dirHandle, dirHandle.name, allowedExtensions, bodyParts);

      finalOutput += bodyParts.join('\n');
      outputText.value = finalOutput;

      statusDiv.textContent = `Successfully processed directory: ${dirHandle.name}`;
      const sizeKb = (new Blob([finalOutput]).size / 1024).toFixed(1);
      statsSpan.textContent = `Files: ${fileCount} // Size: ${sizeKb} KB`;

      copyBtn.disabled = false;
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

/**
 * Discovery Layer: Maps valid schema targets via fast folder evaluation pass.
 */
async function harvestExtensions(dirHandle, extensionSet) {
   for await (const entry of dirHandle.values()) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') continue;

      if (entry.kind === 'directory') {
         await harvestExtensions(entry, extensionSet);
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

/**
 * Upgraded Tree Traversal: Generates accurate directory mapping tree.
 */
async function buildTreeStructure(dirHandle, prefix, lines, allowedExtensions) {
   const entries = [];
   for await (const entry of dirHandle.values()) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') continue;
      entries.push(entry);
   }

   entries.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
   });

   let directoryHasValidContents = false;

   for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const isLast = i === entries.length - 1;
      const pointer = isLast ? '└── ' : '├── ';

      if (entry.kind === 'file') {
         const ext = entry.name.includes('.') ? entry.name.split('.').pop().toLowerCase() : '';
         if (allowedExtensions.includes(ext)) {
            lines.push(`${prefix}${pointer}${entry.name}`);
            directoryHasValidContents = true;
         }
      } else if (entry.kind === 'directory') {
         const subtreeLines = [];
         const newPrefix = prefix + (isLast ? '    ' : '│   ');
         
         const subtreeIsValid = await buildTreeStructure(entry, newPrefix, subtreeLines, allowedExtensions);
         if (subtreeIsValid) {
            lines.push(`${prefix}${pointer}${entry.name}`);
            lines.push(...subtreeLines);
            directoryHasValidContents = true;
         }
      }
   }
   return directoryHasValidContents;
}

// Universal Structural Reduction Layer
function stripToSignatures(content, ext) {
   const normalizedExt = ext.toLowerCase();
   const lines = content.split('\n');

   // Minified Asset Verification Layer
   const avgLineLength = content.length / (lines.length || 1);
   if (avgLineLength > 220 && lines.length < 5) {
      return `// [System Alert: Minified or single-line codebase detected. Fallback signature strategy initiated.]\n${content.substring(0, 500)}... [Truncated due to token limits]`;
   }

   // Strategy Routing Hub
   if (normalizedExt === 'json') return extractJsonSkeleton(lines);
   if (normalizedExt === 'css') return extractCssStructure(lines);
   if (['html', 'xml', 'tscn', 'tres', 'svg'].includes(normalizedExt)) return extractMarkupSkeleton(lines);
   if (['gd', 'py', 'yaml', 'yml'].includes(normalizedExt)) return extractIndentedSignatures(lines);
   if (normalizedExt === 'sql') return extractSqlSchema(lines);

   return extractBracedSignatures(lines);
}

/**
 * Boundary Guard: First 5 + Last 5 lines context mapping
 */
function getSmarterFallback(lines) {
    if (lines.length <= 10) return lines.join('\n');
    return lines.slice(0, 5).join('\n') + 
           "\n// ... [middle execution block omitted to preserve window attention]\n" + 
           lines.slice(-5).join('\n');
}

/**
 * Strategy: Braced Code Token Squashing
 */
function extractBracedSignatures(lines) {
    let output = [];
    const keyPattern = /^(import|export|using|package|require|public|private|protected|static|fn|def|class|interface|struct|type|func|function|async\s+function)/i;
    const commentPattern = /^(\/\*\*|\/\/\/|"""|@)/;
    const maintenancePattern = /(TODO:|FIXME:|@deprecated|CHANGED:)/i;

    for (let line of lines) {
        let trimmed = line.trim();
        
        if (commentPattern.test(trimmed) || maintenancePattern.test(trimmed)) {
            output.push(line);
            continue;
        }

        if (keyPattern.test(trimmed)) {
            if (trimmed.startsWith('import ') || trimmed.startsWith('using ') || trimmed.endsWith(';')) {
                output.push(line);
            } else {
                let squashedLine = line.replace(/\{?\s*$/, ' { ... }');
                output.push(squashedLine);
            }
        }
    }
    return output.length > 0 ? output.join('\n') : getSmarterFallback(lines);
}

/**
 * Strategy: Indentation-Preserving Signatures
 */
function extractIndentedSignatures(lines) {
    let output = [];
    const sigPattern = /^(extends|classname|class|def|fn|signal|export|onready|var|enum|import|from)/i;
    const commentPattern = /^(#|"""|''')/;
    const maintenancePattern = /(TODO:|FIXME:|CHANGED:)/i;

    for (let line of lines) {
        let trimmed = line.trim();
        if (sigPattern.test(trimmed) || commentPattern.test(trimmed) || maintenancePattern.test(trimmed) || trimmed === "") {
            output.push(line);
        }
    }
    return output.length > 0 ? output.join('\n') : getSmarterFallback(lines);
}

/**
 * Strategy: Markup Tag & Inline Attribute Truncation
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
            const openTag = processedLine.substring(0, processedLine.indexOf('>') + 1);
            const closeTag = processedLine.substring(processedLine.lastIndexOf('</'));
            processedLine = processedLine.replace(trimmed, `${openTag}...${closeTag}`);
         }
         
         output.push(processedLine);
      }
   }
   return output.length > 0 ? output.join('\n') : "";
}

/**
 * Strategy: JSON Structural Processing with Counter Guard
 */
function extractJsonSkeleton(lines) {
   let output = [];

   for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      let trimmed = line.trim();
      
      if (output.length > 100) {
          output.push("  // ... [Massive JSON data payload truncated to preserve context schema]");
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
         const key = keyMatch[2];
         const value = keyMatch[3].trim();

         if (value.startsWith('{') || value.startsWith('[')) {
            output.push(line);
         } else {
            const endsWithComma = value.endsWith(',') ? ',' : '';
            output.push(`${indent}"${key}": ...${endsWithComma}`);
         }
      }
   }
   return output.length > 0 ? output.join('\n') : "{\n  // ... [empty or unparseable JSON structural layer]\n}";
}

/**
 * Strategy: CSS Selectors & Reduction Parameters
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
         const parts = line.split(':');
         const property = parts[0];
         output.push(`${property}: ...;`);
      }
   }
   return output.length > 0 ? output.join('\n') : "/* ... [CSS ruleset definitions omitted] */";
}

/**
 * Strategy: Database Schema SQL Filter Engine
 */
function extractSqlSchema(lines) {
    let output = [];
    const schemaPattern = /^(CREATE|ALTER|DROP|TABLE|VIEW|INDEX|PRIMARY KEY|FOREIGN KEY|CONSTRAINT)/i;
    const ignorePattern = /^(INSERT INTO|COPY|VALUES)/i;

    for (let line of lines) {
        let trimmed = line.trim();
        if (ignorePattern.test(trimmed)) continue; 

        if (schemaPattern.test(trimmed) || trimmed === '(' || trimmed === ');' || trimmed.endsWith(',')) {
            output.push(line);
        }
    }
    return output.length > 0 ? output.join('\n') : "-- ... [SQL Schema omitted]";
}

/**
 * Master Data Assembly Layer with Size Threshold Guards
 */
async function aggregateContents(dirHandle, currentPath, allowedExtensions, bodyParts) {
   for await (const entry of dirHandle.values()) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') continue; 
      const entryRelativePath = `${currentPath}/${entry.name}`;

      if (entry.kind === 'directory') {
         await aggregateContents(entry, entryRelativePath, allowedExtensions, bodyParts);
      } else if (entry.kind === 'file') {
         const ext = entry.name.includes('.') ? entry.name.split('.').pop().toLowerCase() : '';

         if (allowedExtensions.includes(ext)) {
            try {
               const file = await entry.getFile();
               
               // 1. Threshold Sizing Pre-flight Guard
               if (file.size > 1048576) {
                  const sizeMb = (file.size / 1024 / 1024).toFixed(2);
                  const fileBlock = `<file path="${entryRelativePath}" language="text">\n` +
                                    `// [System Alert: File exceeds 1MB threshold (${sizeMb} MB). Excluded to prevent context flood and memory locking.]\n` +
                                    `</file>\n`;
                  bodyParts.push(fileBlock);
                  fileCount++;
                  continue; 
               }

               let content = await file.text();
               const lang = getLanguageName(ext);
               
               const originalSize = (file.size / 1024).toFixed(2);
               const originalLines = content.split('\n').length;

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
               console.warn(`Could not read file text at ${entryRelativePath}:`, e);
            }
         }
      }
   }
}

copyBtn.addEventListener('click', () => {
   navigator.clipboard.writeText(outputText.value);
   const originalText = copyBtn.textContent;
   copyBtn.textContent = 'Copied!';
   setTimeout(() => copyBtn.textContent = originalText, 1500);
});

downloadBtn.addEventListener('click', async () => {
   // Get the custom filename from the input, default to 'context.txt' if empty
   const filenameInput = document.getElementById('filename-input');
   const fileName = filenameInput.value.trim() || 'context.txt';

   
   try {
      // 1. Open file save picker
      const handle = await window.showSaveFilePicker({
         suggestedName: fileName,
         type: [{
            description: 'Text file',
            accept: { 'text/plain': ['.txt']}
         }],
      });

      // 2. Create a writable stream and write content
      const writable = await handle.createWritable();

      // 3. Write the output text to the file
      await writable.write(outputText.value);

      // 4. Close the file and save
      await writable.close();
   } catch (err) {
      // Handle cancel or errors
      if (err.name !== 'AbortError') {
         console.error('File save failed:', err);
      }
   }

   /*
   const blob = new Blob([outputText.value], { type: 'text/plain' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   
   a.href = url;
   a.download = fileName; // Use the dynamic filename here
   
   document.body.appendChild(a);
   a.click();
   document.body.removeChild(a);
   URL.revokeObjectURL(url);
   */
});