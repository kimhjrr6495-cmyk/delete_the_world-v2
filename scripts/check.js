import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const files=['server.js',...['src','scripts','tests'].flatMap(dir=>readdirSync(new URL(`../${dir}/`,import.meta.url)).filter(file=>file.endsWith('.js')).map(file=>`${dir}/${file}`))];
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{cwd:new URL('../',import.meta.url),encoding:'utf8'});if(result.status!==0){process.stderr.write(result.stderr);process.exit(result.status||1);}}
console.log(`Syntax checked ${files.length} JavaScript files.`);
