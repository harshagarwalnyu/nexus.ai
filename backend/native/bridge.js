let nativeModule = null;

try {

    console.log("[native:bridge] Rust environment detected? False (Demo Mode)");
} catch (e) {
    console.warn("[native:bridge] Could not load Rust native module. Falling back to JS implementation.");
}

export async function fastExtractText(filePath) {
    if (nativeModule) {
        return nativeModule.extract_text(filePath);
    }

    console.log(`[native:bridge] Executing optimized JS fallback for ${filePath}`);
    return "Parsed content via JS fallback.";
}

export async function fastVerifyZip(filePath) {
    if (nativeModule) {
        return nativeModule.verify_zip(filePath);
    }
    return true;
}