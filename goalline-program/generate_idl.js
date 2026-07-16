const fs = require('fs');
const path = require('path');

const tsFile = path.join(__dirname, '../frontend/src/lib/goalline-idl.ts');
let content = fs.readFileSync(tsFile, 'utf8');

// The file exports `export const GOALLINE_IDL = { ... } as const;`
// We need to extract just the JSON part.
const startIndex = content.indexOf('{');
const endIndex = content.lastIndexOf('}');
let jsonStr = content.substring(startIndex, endIndex + 1);

// Some TS files have trailing commas or identifiers not strictly JSON, 
// but if it's cleanly written it might parse, or we can just replace keys with quotes.
// Let's actually use eval to get the object since it's JS-compatible syntax.

try {
  // Replace `as const` if it accidentally got included
  jsonStr = jsonStr.replace(/as const/g, '');
  const idlObject = eval('(' + jsonStr + ')');
  
  const targetDir = path.join(__dirname, 'target/idl');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(targetDir, 'goalline_program.json'),
    JSON.stringify(idlObject, null, 2)
  );
  console.log("Successfully generated target/idl/goalline_program.json");
} catch (err) {
  console.error("Failed to parse IDL:", err);
  process.exit(1);
}
