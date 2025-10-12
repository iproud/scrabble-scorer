// Fix for handling multiple turns per round-player combination
const fs = require('fs');

let content = fs.readFileSync('client/js/app.js', 'utf8');

// Replace the turn lookup logic to handle arrays
content = content.replace(
    /const turn = turnMap\.get\(key\);\s*\n\s*if \(turn && turn\.word && turn\.word\.trim\(\)\.length > 0\) \{\s*\n\s*const word = turn\.word;/g,
    `const turns = turnMap.get(key);\n                if (turns && turns.length > 0) {\n                    turns.forEach((turn, index) => {\n                        const word = turn.word;`
);

// Replace the word display logic to handle multiple turns
content = content.replace(
    /const word = turn\.word;\s*\n\s*let wordDisplay = .*?;/g,
    `let wordDisplay = \`\${index > 0 ? '<div class=\"text-xs text-gray-500 mt-1\">Turn ' + (index + 1) + ':</div>' : ''}<div class=\"font-medium\">\${word}</div>\`;`
);

// Replace the score display logic
content = content.replace(
    /const score = turn\.score \?\? 0;\s*\n\s*tableHtml \+= `<td class="p-3 \$\{cellClass\}">\s*\n\s*<div class="flex justify-between items-start">\s*\n\s*<div class="flex-1">\$\{wordDisplay\}<\/div>\s*\n\s*<span class="font-bold bg-white px-2 py-1 rounded ml-2 text-sm">\$\{score\}<\/span>\s*\n\s*<\/div>\s*\n\s*<\/td>`;/g,
    `const score = turn.score ?? 0;\n\n                        tableHtml += \`<td class="p-3 \${cellClass}">\n                                        <div class="flex justify-between items-start">\n                                            <div class="flex-1">\${wordDisplay}</div>\n                                            <span class="font-bold bg-white px-2 py-1 rounded ml-2 text-sm">\${score}</span>\n                                        </div>\n                                    </td>\`;`
);

// Close the forEach loop
content = content.replace(
    /const score = turn\.score \?\? 0;\s*\n\s*tableHtml \+= `<td class="p-3 \$\{cellClass\}">\s*\n\s*<div class="flex justify-between items-start">\s*\n\s*<div class="flex-1">\$\{wordDisplay\}<\/div>\s*\n\s*<span class="font-bold bg-white px-2 py-1 rounded ml-2 text-sm">\$\{score\}<\/span>\s*\n\s*<\/div>\s*\n\s*<\/td>`;/g,
    `const score = turn.score ?? 0;\n\n                        tableHtml += \`<td class="p-3 \${cellClass}">\n                                        <div class="flex justify-between items-start">\n                                            <div class="flex-1">\${wordDisplay}</div>\n                                            <span class="font-bold bg-white px-2 py-1 rounded ml-2 text-sm">\${score}</span>\n                                        </div>\n                                    </td>\n\`;`
                    });`
);

fs.writeFileSync('client/js/app.js', content);
console.log('Turn map fix applied successfully!');
