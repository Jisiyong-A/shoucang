ObjC.import('Foundation');
ObjC.import('Vision');

// JXA invokes this entrypoint by name.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function run(argv) {
  const results = [];

  for (const inputPath of argv) {
    const path = $.NSString.stringWithString(inputPath).stringByStandardizingPath;
    const imageUrl = $.NSURL.fileURLWithPath(path);
    const request = $.VNRecognizeTextRequest.alloc.init;
    request.recognitionLevel = $.VNRequestTextRecognitionLevelAccurate;
    request.recognitionLanguages = $.NSArray.arrayWithArray(['zh-Hans', 'zh-Hant', 'en-US']);
    request.usesLanguageCorrection = true;

    const handler = $.VNImageRequestHandler.alloc.initWithURLOptions(
      imageUrl,
      $.NSDictionary.dictionary,
    );
    const error = Ref();
    const ok = handler.performRequestsError($.NSArray.arrayWithObject(request), error);
    if (!ok) {
      const message = error[0] ? ObjC.unwrap(error[0].localizedDescription) : 'OCR failed';
      results.push({ path: inputPath, text: '', error: message });
      continue;
    }

    const lines = [];
    const observations = request.results;
    const count = observations ? observations.count : 0;
    for (let index = 0; index < count; index += 1) {
      const candidate = observations.objectAtIndex(index).topCandidates(1).firstObject;
      if (candidate) lines.push(ObjC.unwrap(candidate.string));
    }
    results.push({ path: inputPath, text: lines.join('\n') });
  }

  return JSON.stringify(results);
}
