const fs = require("fs");
const { TextractClient, DetectDocumentTextCommand, AnalyzeDocumentCommand } = require("@aws-sdk/client-textract");

const client = new TextractClient({ region: process.env.AWS_REGION || "us-east-1" });
const WORD_COUNT_THRESHOLD = 50;
const CONFIDENCE_THRESHOLD = 70;

async function runOCR(filePath) {
  const documentBytes = new Uint8Array(fs.readFileSync(filePath));
  console.log("\n📄 File:", filePath);
  console.log("─".repeat(50));

  console.log("\n🔍 Step 1: DetectDocumentText...");
  const detectResult = await client.send(new DetectDocumentTextCommand({ Document: { Bytes: documentBytes } }));
  const wordBlocks = (detectResult.Blocks || []).filter(b => b.BlockType === "WORD");
  const wordCount = wordBlocks.length;
  const avgConf = wordCount > 0 ? wordBlocks.reduce((s, b) => s + (b.Confidence || 0), 0) / wordCount : 0;

  console.log(`   Word count:     ${wordCount}`);
  console.log(`   Avg confidence: ${avgConf.toFixed(1)}%`);

  if (wordCount >= WORD_COUNT_THRESHOLD && avgConf >= CONFIDENCE_THRESHOLD) {
    console.log("\n✅ FAST PATH — DetectDocumentText succeeded");
    console.log("   Text preview:", wordBlocks.map(b => b.Text).join(" ").slice(0, 300));
  } else {
    console.log("\n⚠️  FALLBACK — Running AnalyzeDocument (FORMS+TABLES)...");
    const analyzeResult = await client.send(new AnalyzeDocumentCommand({
      Document: { Bytes: documentBytes },
      FeatureTypes: ["FORMS", "TABLES"]
    }));
    const analyzeWords = (analyzeResult.Blocks || []).filter(b => b.BlockType === "WORD");
    console.log(`   AnalyzeDocument word count: ${analyzeWords.length}`);
    console.log("   Text preview:", analyzeWords.map(b => b.Text).join(" ").slice(0, 300));
  }
  console.log("\n✅ Done\n");
}

const filePath = process.argv[2];
if (!filePath || !fs.existsSync(filePath)) {
  console.error("❌ Usage: node test-ocr.js <path-to-pdf>");
  process.exit(1);
}
runOCR(filePath).catch(err => { console.error("❌ Error:", err.message); process.exit(1); });
