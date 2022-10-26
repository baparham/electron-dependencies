import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { downloadFile, getChromiumDepsFilename } from './download';

type ChromiumDepsJson = { [id: string]: string };

const depsFilePythonFunctions = `# This section of the file has been added by electron-dependencies
# Helper function to process strings
def Str(value):
  return str(value)

# Helper function to access variables
def Var(value):
  return vars[value]

`;

function generateCodeToDumpJson(inputFile: string, outFile: string): string {
  return `import ${basename(inputFile.replace('.py', ''))} as chromium_deps
import json
filename = r"${outFile}"
with open(filename, 'w') as f:
  json.dump(chromium_deps.deps, f, indent=2)
`;
}

function dumpDepsToJson(tmpDir: string, depsFilename: string, depsJsonFilename: string): void {
  const pythonScript = join(tmpDir, 'dump_deps.py');
  writeFileSync(pythonScript, generateCodeToDumpJson(depsFilename, depsJsonFilename));
  const proc = spawnSync(`python "${pythonScript}"`, { shell: true });
  if (proc.status !== 0) {
    console.error(proc.output.toString());
    throw new Error('Python dependency extraction failed. Details:\n' + proc.output);
  }
}

function getTmpDir(): string {
  const tmpDir = join(__dirname, '..', 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}

async function writeChromiumDepsFile(depsFilename: string, tag: string) {
  writeFileSync(depsFilename, depsFilePythonFunctions);
  await downloadFile(getChromiumDepsFilename(tag), depsFilename, { flags: 'a' });
}

export async function getChromiumDependencyMap(tag: string): Promise<ChromiumDepsJson> {
  const tmpDir = getTmpDir();
  const depsJsonFilename = join(tmpDir, `chromium-deps.json`);
  const depsFilename = join(tmpDir, `chromium_deps.py`);
  await writeChromiumDepsFile(depsFilename, tag);
  dumpDepsToJson(tmpDir, depsFilename, depsJsonFilename);
  return JSON.parse(readFileSync(depsJsonFilename).toString());
}
