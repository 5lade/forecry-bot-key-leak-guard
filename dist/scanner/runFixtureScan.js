import { scanText } from './scanner.js';
import { fixtureCases } from './fixtureData.js';
const hmacSecret = process.env.HMAC_SECRET ?? 'fixture-hmac-secret-32-bytes';
let truePositives = 0;
let falseNegatives = 0;
let falsePositives = 0;
let trueNegatives = 0;
let leakedRawSecret = false;
const findingPayloads = [];
for (const fixture of fixtureCases) {
    const result = scanText({ content: fixture.content, filePath: `${fixture.id}.txt`, hmacSecret });
    const found = result.findings.length > 0;
    if (fixture.expectedFindings > 0 && found)
        truePositives += 1;
    if (fixture.expectedFindings > 0 && !found)
        falseNegatives += 1;
    if (fixture.expectedFindings === 0 && found)
        falsePositives += 1;
    if (fixture.expectedFindings === 0 && !found)
        trueNegatives += 1;
    const serialized = JSON.stringify(result.findings);
    findingPayloads.push(serialized);
    if (fixture.rawSecret && serialized.includes(fixture.rawSecret))
        leakedRawSecret = true;
}
const truePositiveRate = truePositives / (truePositives + falseNegatives);
const falsePositiveRate = falsePositives / (falsePositives + trueNegatives);
console.log(`true_positive_rate=${truePositiveRate.toFixed(2)} false_positive_rate=${falsePositiveRate.toFixed(2)}`);
console.log(`true_positives=${truePositives} false_negatives=${falseNegatives} false_positives=${falsePositives} true_negatives=${trueNegatives}`);
console.log(`raw_secret_leak=${leakedRawSecret ? 'true' : 'false'}`);
if (truePositiveRate < 0.95 || falsePositiveRate > 0.05 || leakedRawSecret) {
    process.exitCode = 1;
}
