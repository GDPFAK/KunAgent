const fs = require('fs');
var c = fs.readFileSync('kun/src/loop/agent-loop.ts', 'utf8');

// Verify file integrity
if (!c.startsWith('import ')) { console.error('CORRUPTED FILE'); process.exit(1); }

// Step B1: Update call site
c = c.replace(
  'const visionDescription = await this.dispatchImageToVisionModel(attachment, input.threadId)',
  'const visionDescription = await this.dispatchImageToVisionModel(attachment, input.threadId, input.turnPrompt, input.workspace)'
);

// Step B2: Replace method definition (use line-based, find the exact method boundaries)
var lines = c.split('\n');
var methodStart = -1;
var methodEnd = -1;
var inMethod = false;

for (var i = 0; i < lines.length; i++) {
  if (lines[i].trim() === 'private async dispatchImageToVisionModel(') {
    methodStart = i;
    inMethod = true;
  }
  if (inMethod && lines[i].trim() === '}' && i > methodStart + 5) {
    // Check if next line after some blank lines contains 'Convenience'
    for (var k = i + 1; k < Math.min(i + 5, lines.length); k++) {
      if (lines[k].includes('Convenience factory')) {
        methodEnd = i;
        break;
      }
    }
    if (methodEnd > 0) break;
  }
}

if (methodStart < 0 || methodEnd < 0) {
  console.error('Method boundaries not found');
  process.exit(1);
}

console.log('Found method: lines ' + (methodStart + 1) + ' to ' + (methodEnd + 1));

var oldMethod = lines.slice(methodStart, methodEnd + 1);

var newMethod = [
  '  private async dispatchImageToVisionModel(',
  '    attachment: AttachmentContent,',
  '    threadId: string,',
  '    taskContext: string,',
  '    workspace: string',
  '  ): Promise<string | null> {',
  '    const visionModel = this.findVisionCapableModel()',
  '    if (!visionModel) return null',
  '    const fileName = "vision_" + attachment.id.slice(0, 8) + ".html"',
  '    const filePath = join(workspace, fileName)',
  '    try {',
  '      const step1 = await this.visionGenerate(visionModel, attachment, taskContext)',
  '      if (!step1 || !step1.code) return null',
  '      await writeFile(filePath, step1.code, "utf-8")',
  '      const step2 = await this.visionRefine(visionModel, attachment, step1.code)',
  '      if (step2 && step2.code && step2.code !== step1.code) {',
  '        await writeFile(filePath, step2.code, "utf-8")',
  '      }',
  '      return "Generated " + fileName + " and refined after visual comparison."',
  '    } catch { return null }',
  '  }',
  '',
  '  /** Step 1: Generate code from image. */',
  '  private async visionGenerate(',
  '    model: string,',
  '    attachment: AttachmentContent,',
  '    _taskContext: string',
  '  ): Promise<{ code: string } | null> {',
  '    try {',
  '      var r = this.opts.model.stream({',
  '        threadId: "vision_gen_" + attachment.id,',
  '        turnId: "gen_" + attachment.id + "_" + Date.now(),',
  '        model,',
  '        systemPrompt: [',
  '          "You are a front-end developer. Analyze the image and generate",',
  '          "complete, production-ready HTML+CSS code that accurately",',
  '          "reproduces the layout, colors, spacing, typography, and style.",',
  '          "Output ONLY the full HTML code in a ```html code block.",',
  '          "Include all CSS inline in a style tag."',
  '        ].join("\\n"),',
  '        attachments: [{ id: attachment.id, name: attachment.name,',
  '          mimeType: attachment.mimeType,',
  '          dataBase64: attachment.data.toString("base64") }],',
  '        tools: [],',
  '        abortSignal: AbortSignal.timeout(30_000),',
  '        stream: false, maxTokens: 4096, temperature: 0.1,',
  '        reasoningEffort: "off"',
  '      })',
  '      var text = ""',
  '      for await (const ch of r) {',
  '        if (ch.kind === "assistant_text_delta") text += ch.text',
  '        if (ch.kind === "error") return null',
  '      }',
  '      const code = extractHtmlCodeBlock(text)',
  '      return code ? { code } : null',
  '    } catch { return null }',
  '  }',
  '',
  '  /** Step 2: Compare and refine. */',
  '  private async visionRefine(',
  '    model: string,',
  '    attachment: AttachmentContent,',
  '    previousCode: string',
  '  ): Promise<{ code: string } | null> {',
  '    try {',
  '      var r = this.opts.model.stream({',
  '        threadId: "vision_refine_" + attachment.id,',
  '        turnId: "refine_" + attachment.id + "_" + Date.now(),',
  '        model,',
  '        systemPrompt: [',
  '          "Compare the image with your previously generated code below.",',
  '          "Identify and fix mismatches in: colors, spacing, layout, fonts.",',
  '          "Output ONLY the corrected COMPLETE HTML in ```html block.",',
  '          "If code already matches, output it unchanged.",',
  '          "",',
  '          "--- Previously generated code ---",',
  '          previousCode,',
  '          "---"',
  '        ].join("\\n"),',
  '        attachments: [{ id: attachment.id, name: attachment.name,',
  '          mimeType: attachment.mimeType,',
  '          dataBase64: attachment.data.toString("base64") }],',
  '        tools: [],',
  '        abortSignal: AbortSignal.timeout(30_000),',
  '        stream: false, maxTokens: 4096, temperature: 0.1,',
  '        reasoningEffort: "off"',
  '      })',
  '      var text = ""',
  '      for await (const ch of r) {',
  '        if (ch.kind === "assistant_text_delta") text += ch.text',
  '        if (ch.kind === "error") return null',
  '      }',
  '      const code = extractHtmlCodeBlock(text)',
  '      return code ? { code } : null',
  '    } catch { return null }',
  '  }',
];

var before = lines.slice(0, methodStart);
var after = lines.slice(methodEnd + 1);
c = before.join('\n') + '\n' + newMethod.join('\n') + '\n' + after.join('\n');

// Step C: Add extractHtmlCodeBlock function
var insertIdx = c.lastIndexOf('function prefixVolatilityStageDetails');
if (insertIdx < 0) { console.error('prefixVolatilityStageDetails not found'); process.exit(1); }

var extractFunc = [
  '',
  '/** Extract HTML code block from markdown code fence. */',
  'function extractHtmlCodeBlock(text: string): string | null {',
  '  var start = text.indexOf("```html")',
  '  if (start < 0) start = text.indexOf("```")',
  '  if (start < 0) return null',
  '  start = text.indexOf("\\n", start)',
  '  if (start < 0) return null',
  '  start += 1',
  '  var end = text.indexOf("```", start)',
  '  if (end < 0) return text.substring(start).trim()',
  '  return text.substring(start, end).trim()',
  '}',
  ''
].join('\n');

c = c.substring(0, insertIdx) + extractFunc + c.substring(insertIdx);

fs.writeFileSync('kun/src/loop/agent-loop.ts', c, 'utf8');
console.log('SUCCESS: all changes applied');
console.log('roleConfig.model:', c.includes('roleConfig?.model'));
console.log('visionGenerate:', c.includes('visionGenerate'));
console.log('extractHtmlCodeBlock:', c.includes('extractHtmlCodeBlock'));
console.log('file OK:', c.startsWith('import '));
