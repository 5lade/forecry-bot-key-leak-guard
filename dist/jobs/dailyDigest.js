import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateDailyDigest, renderTelegramDigest } from '../digest/digest.js';
export function renderDailyDigestFromFixture(path = resolve(process.cwd(), 'test/fixtures/daily-digest.json')) {
    const input = JSON.parse(readFileSync(path, 'utf8'));
    return renderTelegramDigest(generateDailyDigest(input));
}
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log(renderDailyDigestFromFixture(process.argv[2]));
}
