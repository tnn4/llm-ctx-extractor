// Language Mapping Layer
function getLanguageName(ext) {
   const mapping = {
      'rs': 'rust',
      'gd': 'godotscript',
      'lua': 'lua',
      'cs': 'csharp',
      'py': 'python',
      'js': 'javascript',
      'ts': 'typescript',
      'cpp': 'cpp',
      'cc': 'cpp',
      'cxx': 'cpp',
      'hpp': 'cpp',
      'h': 'cpp',
      'c': 'c',
      'go': 'go',
      'rb': 'ruby',
      'fs': 'fsharp',
      'fsi': 'fsharp',
      'fsx': 'fsharp',
      'java': 'java',
      'kt': 'kotlin',
      'swift': 'swift',
      'tscn': 'godot-data',
      'tres': 'godot-data',
      'godot': 'godot-data',
      'gdshader': 'godot-shader',
      'unity': 'unity-data',
      'prefab': 'unity-data',
      'meta': 'unity-data',
      'mat': 'unity-data',
      'uproject': 'unreal-data',
      'uasset': 'unreal-data',
      'umap': 'unreal-data',
      'glsl': 'glsl',
      'vert': 'glsl',
      'frag': 'glsl',
      'comp': 'glsl',
      'geom': 'glsl',
      'hlsl': 'hlsl',
      'fx': 'hlsl',
      'hlsli': 'hlsl',
      'wgsl': 'wgsl',
      'makefile': 'makefile',
      'make': 'makefile',
      'mk': 'makefile',
      'dockerfile': 'dockerfile',
      'dockerignore': 'dockerfile',
      'env': 'dotenv',
      'lock': 'lockfile',
      'cmake': 'cmake',
      'sh': 'shell',
      'bash': 'shell',
      'ps1': 'powershell',
      'psm1': 'powershell',
      'psd1': 'powershell',
      'bat': 'batch',
      'cmd': 'batch',
      'toml': 'toml',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'xml': 'xml',
      'csproj': 'xml',
      'fsproj': 'xml',
      'ini': 'ini',
      'cfg': 'ini',
      'prefs': 'ini',
      'csv': 'csv',
      'md': 'markdown',
      'markdown': 'markdown',
      'txt': 'text',
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'sql': 'sql'
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

      const allowedExtensions = extensionsInput.value
         .trim()
         .split(/\s+/)
         .map(ext => ext.replace(/^\./, '').toLowerCase());

      // 1. Structural visual tree traversal map
      const treeLines = [dirHandle.name];
      await buildTreeStructure(dirHandle, "", treeLines);

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

async function buildTreeStructure(dirHandle, prefix, lines) {
   const entries = [];
   for await (const entry of dirHandle.values()) {
      entries.push(entry);
   }

   entries.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
   });

   for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const isLast = i === entries.length - 1;
      const pointer = isLast ? '└── ' : '├── ';

      lines.push(`${prefix}${pointer}${entry.name}`);

      if (entry.kind === 'directory') {
         const newPrefix = prefix + (isLast ? '    ' : '│   ');
         await buildTreeStructure(entry, newPrefix, lines);
      }
   }
}

// Universal Structural Reduction Layer
function stripToSignatures(content, ext) {
   const lines = content.split('\n');
   const normalizedExt = ext.toLowerCase();

   // 1. Structured Serialized Data
   if (normalizedExt === 'json') {
      return extractJsonSkeleton(lines);
   }

   // 2. Declarative Styling/Layouts
   if (normalizedExt === 'css') {
      return extractCssStructure(lines);
   }

   // 3. Markup & Component Trees (New)
   if (['html', 'xml', 'tscn', 'tres', 'svg'].includes(normalizedExt)) {
      return extractMarkupSkeleton(lines);
   }

   // 4. Indentation-Based Languages (New)
   if (['gd', 'py', 'yaml', 'yml'].includes(normalizedExt)) {
      return extractIndentedSignatures(lines);
   }

   // 5. Default Fallback: Braced Algorithmic/Compiled Languages
   return extractBracedSignatures(lines);
}

/**
 * Strategy: Markup Tag Skeletization
 * Wipes out deep inline text nodes while preserving component/element hierarchies.
 */
function extractMarkupSkeleton(lines) {
   let output = [];

   for (let line of lines) {
      let trimmed = line.trim();

      // Retain structural tags, doctypes, comments, or component wrappers
      // Strips lines that are purely text contents between tags
      if (trimmed.startsWith('<') || trimmed.endsWith('>')) {
         // Drop heavy content chunks inside tags if they look like paragraphs
         if (trimmed.includes('>') && trimmed.includes('</') && trimmed.length > 120) {
            const openTag = trimmed.substring(0, trimmed.indexOf('>') + 1);
            const closeTag = trimmed.substring(trimmed.lastIndexOf('</'));
            output.push(line.replace(trimmed, `${openTag}...${closeTag}`));
         } else {
            output.push(line);
         }
      }
   }

   return output.length > 0 ? output.join('\n') : "";
}

/**
 * Strategy: Indentation-Preserving Signatures (Enhanced)
 */
function extractIndentedSignatures(lines) {
    let output = [];
    const sigPattern = /^(extends|classname|class|def|fn|signal|export|onready|var|enum|import|from)/i;
    const commentPattern = /^(#|"""|''')/;

    for (let line of lines) {
        let trimmed = line.trim();
        if (sigPattern.test(trimmed) || commentPattern.test(trimmed) || trimmed === "") {
            output.push(line);
        }
    }
    return output.length > 0 ? output.join('\n') : getSmarterFallback(lines);
}

/**
 * Strategy: Braced Code Structural Signatures (Enhanced)
 * Preserves imports, docstrings, and signatures.
 */
function extractBracedSignatures(lines) {
    let output = [];
    // Whitelist: Imports, Exports, Docstrings, and standard signatures
    const keyPattern = /^(import|export|using|package|require|public|private|protected|static|fn|def|class|interface|struct|type|func)/i;
    const commentPattern = /^(\/\*\*|\/\/\/|"""|@)/;

    for (let line of lines) {
        let trimmed = line.trim();
        if (keyPattern.test(trimmed) || commentPattern.test(trimmed) || 
            trimmed === '{' || trimmed === '}' || trimmed.endsWith(';')) {
            output.push(line);
        }
    }
    return output.length > 0 ? output.join('\n') : getSmarterFallback(lines);
}

// Keep your existing extractJsonSkeleton and extractCssStructure strategies unchanged below...
/**
 * Strategy: JSON Schema/Key Skeletization
 * Drops deep values, long strings, or massive lists to isolate data schema.
 */
function extractJsonSkeleton(lines) {
   let output = [];

   for (let line of lines) {
      let trimmed = line.trim();

      // Retain structural brackets
      if (trimmed === '{' || trimmed === '}' || trimmed === '[' || trimmed === ']' || trimmed === '},' || trimmed === '],') {
         output.push(line);
         continue;
      }

      // Match JSON key patterns ("key": value)
      const keyMatch = line.match(/^(\s*)"([^"]+)"\s*:\s*(.*)$/);
      if (keyMatch) {
         const indent = keyMatch[1];
         const key = keyMatch[2];
         const value = keyMatch[3].trim();

         // If the value opens a new structural block, keep the line intact
         if (value.startsWith('{') || value.startsWith('[')) {
            output.push(line);
         }
         // If it's a primitive value, stub it out to save token space
         else {
            const endsWithComma = value.endsWith(',') ? ',' : '';
            output.push(`${indent}"${key}": ...${endsWithComma}`);
         }
      }
   }

   return output.length > 0 ? output.join('\n') : "{\n  // ... [empty or unparseable JSON structural layer]\n}";
}

/**
 * Strategy: CSS Selector & Token Reduction
 * Retains selectors, media queries, and property names while wiping layout values.
 */
function extractCssStructure(lines) {
   let output = [];

   for (let line of lines) {
      let trimmed = line.trim();

      // Retain media queries, structural comments, or block containers
      if (trimmed.startsWith('@') || trimmed === '{' || trimmed === '}' || trimmed.endsWith('{') || trimmed.endsWith('}')) {
         output.push(line);
         continue;
      }

      // Detect rule definitions (property: value;)
      if (trimmed.includes(':') && trimmed.endsWith(';')) {
         const parts = line.split(':');
         const property = parts[0];
         // Keep property token but drop values (e.g., massive base64 URIs, long gradients)
         output.push(`${property}: ...;`);
      }
   }

   return output.length > 0 ? output.join('\n') : "/* ... [CSS ruleset definitions omitted] */";
}


async function aggregateContents(dirHandle, currentPath, allowedExtensions, bodyParts) {
   for await (const entry of dirHandle.values()) {
      const entryRelativePath = `${currentPath}/${entry.name}`;

      if (entry.kind === 'directory') {
         await aggregateContents(entry, entryRelativePath, allowedExtensions, bodyParts);
      } else if (entry.kind === 'file') {
         const ext = entry.name.includes('.') ? entry.name.split('.').pop().toLowerCase() : '';

         if (allowedExtensions.includes(ext)) {
            try {
               const file = await entry.getFile();
               let content = await file.text();
               const lang = getLanguageName(ext);

               // UPDATED: Pass ext directly into the structural modifier
               if (document.getElementById('mode-toggle').checked) {
                  content = stripToSignatures(content, ext);
               }

               const fileBlock = `<file path="${entryRelativePath}" language="${lang}">\n${content}\n</file>\n`;
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

downloadBtn.addEventListener('click', () => {
   const blob = new Blob([outputText.value], {
      type: 'text/plain'
   });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = 'context.txt';
   document.body.appendChild(a);
   a.click();
   document.body.removeChild(a);
   URL.revokeObjectURL(url);
});