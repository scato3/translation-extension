// 번역 데이터
let translations = null;

// 검색 모드 (true: 완전 일치, false: 부분 일치)
let exactMatchMode = false;

// 페이지에서 텍스트 분석 및 표시
function processPage() {
  try {
    // 이미 존재하는 패널이 있다면 제거
    const existingPanel = document.getElementById("i18n-translation-panel");
    if (existingPanel) {
      document.body.removeChild(existingPanel);
    }

    // 번역 데이터 확인
    if (!translations || Object.keys(translations).length === 0) {
      showMessagePanel(
        "Translation data is not loaded. Please upload translation files in the extension popup."
      );
      return;
    }

    // 모든 텍스트 노드 가져오기 및 분석
    const result = findMatchingKeys();

    if (result.keys.size === 0) {
      showMessagePanel("No matching translations found on this page.");
      return;
    }

    // 패널 생성 및 표시
    showKeysPanel(result);
  } catch (error) {
    console.error("Error in processPage:", error);
    showMessagePanel("An error occurred while processing the page.");
  }
}

// 텍스트 노드에서 매칭되는 키 찾기
function findMatchingKeys() {
  const foundKeys = new Set();
  const textNodes = [];
  const keyToTexts = {}; // 키별로 발견된 텍스트를 저장

  // 번역 데이터 검증
  if (!translations || Object.keys(translations).length === 0) {
    console.error("Translation data is missing or empty");
    return { keys: foundKeys, keyToTexts: keyToTexts };
  }

  try {
    console.log(
      "Finding matching keys with translations:",
      Object.keys(translations)
    );
    console.log(
      "Search mode:",
      exactMatchMode ? "Exact match" : "Partial match"
    );

    // 텍스트 노드 추출 - 화면에 보이는 텍스트만 추출
    const walk = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          // 빈 텍스트 노드는 무시
          if (node.nodeValue.trim() === "") {
            return NodeFilter.FILTER_REJECT;
          }
          // script, style 태그 내 텍스트 무시
          if (
            ["SCRIPT", "STYLE", "NOSCRIPT"].includes(node.parentNode.tagName)
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          // 화면에 보이는 요소인지 확인
          const element = node.parentNode;
          const style = window.getComputedStyle(element);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            style.opacity === "0"
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    let currentNode;
    while ((currentNode = walk.nextNode())) {
      textNodes.push(currentNode.nodeValue.trim());
    }

    console.log(`Found ${textNodes.length} text nodes on the page`);

    // 텍스트 검색 방식 개선 - 페이지에 있는 각 단어를 기준으로 매칭
    const pageWords = new Set();
    textNodes.forEach((text) => {
      // 너무 긴 텍스트는 건너뜀
      if (text.length > 200) return;

      // 텍스트에서 단어 추출
      const words = text.match(/\b\w+\b/g) || [];
      words.forEach((word) => {
        if (word && word.length > 1) {
          pageWords.add(word.toLowerCase());
        }
      });

      // 전체 텍스트도 추가
      pageWords.add(text);
    });

    // 실제 매칭 시도
    Object.entries(translations).forEach(([langCode, langData]) => {
      Object.entries(langData).forEach(([key, value]) => {
        if (typeof value === "string" && value.trim() !== "") {
          // 완전 일치 모드일 때
          if (exactMatchMode) {
            textNodes.forEach((text) => {
              if (text === value) {
                foundKeys.add(key);

                // 매칭된 텍스트 저장 (중복 방지)
                if (!keyToTexts[key]) {
                  keyToTexts[key] = [];
                }
                if (!keyToTexts[key].includes(text)) {
                  keyToTexts[key].push(`[Exact match] ${text}`);
                }
              }
            });
          }
          // 부분 일치 모드일 때
          else {
            // 값이 페이지의 어떤 텍스트에 포함되는지 확인
            textNodes.forEach((text) => {
              if (text.includes(value)) {
                foundKeys.add(key);

                // 매칭된 텍스트 저장 (중복 방지)
                if (!keyToTexts[key]) {
                  keyToTexts[key] = [];
                }
                if (!keyToTexts[key].includes(text)) {
                  keyToTexts[key].push(text);
                }
              }
            });

            // 값에서 단어 추출해서 페이지의 단어와 비교
            const valueWords = value.match(/\b\w+\b/g) || [];
            let wordMatches = 0;

            valueWords.forEach((word) => {
              if (
                word &&
                word.length > 1 &&
                pageWords.has(word.toLowerCase())
              ) {
                wordMatches++;
              }
            });

            // 최소 2개 이상의 단어가 일치하면 결과에 추가
            if (valueWords.length >= 3 && wordMatches >= 2) {
              foundKeys.add(key);

              if (!keyToTexts[key]) {
                keyToTexts[key] = [];
              }

              keyToTexts[key].push(
                `Matched ${wordMatches} words from: "${value}"`
              );
            }
          }
        }
      });
    });

    console.log(`Found ${foundKeys.size} matching keys`);
  } catch (error) {
    console.error("Error in findMatchingKeys:", error);
  }

  return { keys: foundKeys, keyToTexts: keyToTexts };
}

// 메시지 패널 표시
function showMessagePanel(message) {
  const panel = document.createElement("div");
  panel.id = "i18n-translation-panel";
  panel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 350px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    z-index: 9999;
    font-family: Arial, sans-serif;
    font-size: 14px;
    overflow: hidden;
  `;

  // 패널 헤더
  const header = createPanelHeader("Translation Keys");

  // 패널 내용
  const content = document.createElement("div");
  content.style.cssText = `
    padding: 15px;
  `;
  content.innerHTML = `<p>${message}</p>`;

  panel.appendChild(header);
  panel.appendChild(content);
  document.body.appendChild(panel);
}

// 키 목록 패널 표시
function showKeysPanel(results) {
  const panel = document.createElement("div");
  panel.id = "i18n-translation-panel";
  panel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 350px;
    max-height: 400px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    z-index: 9999;
    font-family: Arial, sans-serif;
    font-size: 14px;
    overflow: hidden;
  `;

  // 패널 헤더
  const header = createPanelHeader("Translation Keys", results);

  // 패널 내용 (스크롤 가능)
  const contentWrapper = document.createElement("div");
  contentWrapper.style.cssText = `
    max-height: 350px;
    overflow-y: auto;
    padding: 12px;
  `;

  // 키 카드 생성
  Array.from(results.keys)
    .sort()
    .forEach((key) => {
      const card = document.createElement("div");
      card.style.cssText = `
      margin-bottom: 15px;
      padding: 12px;
      background-color: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #4285f4;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    `;

      // 키 제목
      const keyTitle = document.createElement("div");
      keyTitle.style.cssText = `
      font-weight: bold;
      color: #4285f4;
      font-size: 16px;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e0e0e0;
    `;
      keyTitle.textContent = `Key: ${key}`;
      card.appendChild(keyTitle);

      // 각 언어별 번역값 (새로운 형식)
      Object.entries(translations).forEach(([langCode, langData]) => {
        const value = langData[key] || "(No translation)";

        const translationRow = document.createElement("div");
        translationRow.style.cssText = `
        display: flex;
        margin-bottom: 8px;
      `;

        const langLabel = document.createElement("div");
        langLabel.style.cssText = `
        min-width: 35px;
        font-weight: bold;
        color: #555;
        margin-right: 10px;
      `;
        langLabel.textContent = `${langCode}:`;

        const valueText = document.createElement("div");
        valueText.style.cssText = `
        flex: 1;
        color: #333;
      `;
        valueText.textContent = value;

        translationRow.appendChild(langLabel);
        translationRow.appendChild(valueText);
        card.appendChild(translationRow);
      });

      // 발견된 텍스트 표시 (해당 키에 매칭된 텍스트가 있는 경우)
      const matchedTexts = results.keyToTexts[key] || [];
      if (matchedTexts.length > 0) {
        const matchesSection = document.createElement("div");
        matchesSection.style.cssText = `
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px dashed #e0e0e0;
      `;

        const matchesTitle = document.createElement("div");
        matchesTitle.style.cssText = `
        font-weight: bold;
        color: #555;
        font-size: 12px;
        margin-bottom: 5px;
      `;
        matchesTitle.textContent = "Found text:";
        matchesSection.appendChild(matchesTitle);

        // 각 매칭된 텍스트 표시
        matchedTexts.forEach((text) => {
          const textItem = document.createElement("div");
          textItem.style.cssText = `
          padding: 4px 8px;
          margin-bottom: 3px;
          background-color: #f2f2f2;
          border-radius: 3px;
          font-size: 12px;
          color: #555;
          word-break: break-word;
        `;
          // 너무 긴 텍스트는 자름
          textItem.textContent =
            text.length > 50 ? text.substring(0, 47) + "..." : text;
          matchesSection.appendChild(textItem);
        });

        card.appendChild(matchesSection);
      }

      contentWrapper.appendChild(card);
    });

  panel.appendChild(header);
  panel.appendChild(contentWrapper);
  document.body.appendChild(panel);
}

// 패널 헤더 생성
function createPanelHeader(title, results = null) {
  const header = document.createElement("div");
  header.style.cssText = `
    padding: 12px;
    background-color: #4285f4;
    color: white;
    font-weight: bold;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;

  const titleElem = document.createElement("span");
  titleElem.textContent = title;

  const buttonContainer = document.createElement("div");
  buttonContainer.style.cssText = `
    display: flex;
    gap: 10px;
    align-items: center;
  `;

  // 다운로드 버튼 추가 (결과가 있을 때만)
  if (results && results.keys.size > 0) {
    const downloadButton = document.createElement("button");
    downloadButton.innerHTML = "↓";
    downloadButton.title = "결과 다운로드";
    downloadButton.style.cssText = `
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      padding: 4px 6px;
      margin: 0;
      border-radius: 4px;
    `;

    downloadButton.addEventListener("click", () => {
      exportResults(results);
    });

    buttonContainer.appendChild(downloadButton);
  }

  // 완전 일치 모드 전환 버튼 추가
  const exactMatchButton = document.createElement("button");
  exactMatchButton.innerHTML = "=";
  exactMatchButton.title = exactMatchMode
    ? "완전 일치 모드 (활성화됨)"
    : "완전 일치 모드 (비활성화됨)";
  exactMatchButton.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 18px;
    cursor: pointer;
    padding: 4px 6px;
    margin: 0;
    border-radius: 4px;
    background-color: ${
      exactMatchMode ? "rgba(255, 255, 255, 0.3)" : "transparent"
    };
    font-weight: bold;
  `;

  exactMatchButton.addEventListener("click", () => {
    // 완전 일치 모드 전환
    exactMatchMode = !exactMatchMode;

    // 버튼 스타일 업데이트
    exactMatchButton.title = exactMatchMode
      ? "완전 일치 모드 (활성화됨)"
      : "완전 일치 모드 (비활성화됨)";
    exactMatchButton.style.backgroundColor = exactMatchMode
      ? "rgba(255, 255, 255, 0.3)"
      : "transparent";

    // 현재 페이지 다시 처리
    const panel = document.getElementById("i18n-translation-panel");
    if (panel) document.body.removeChild(panel);
    processPage();
  });

  // 새로고침 버튼 추가
  const refreshButton = document.createElement("button");
  refreshButton.innerHTML = "↻";
  refreshButton.title = "다시 받아오기";
  refreshButton.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 18px;
    cursor: pointer;
    padding: 0;
    margin: 0;
  `;
  refreshButton.addEventListener("click", () => {
    // 현재 페이지 다시 처리
    const panel = document.getElementById("i18n-translation-panel");
    if (panel) document.body.removeChild(panel);
    processPage();
  });

  const closeButton = document.createElement("button");
  closeButton.innerHTML = "×";
  closeButton.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    margin: 0;
  `;
  closeButton.addEventListener("click", () => {
    const panel = document.getElementById("i18n-translation-panel");
    if (panel) document.body.removeChild(panel);
  });

  buttonContainer.appendChild(exactMatchButton);
  buttonContainer.appendChild(refreshButton);
  buttonContainer.appendChild(closeButton);

  header.appendChild(titleElem);
  header.appendChild(buttonContainer);

  return header;
}

// 결과를 파일로 내보내기 기능
function exportResults(results) {
  try {
    // 결과를 JSON 형식으로 포맷팅
    const exportData = {
      searchMode: exactMatchMode ? "Exact Match" : "Partial Match",
      timestamp: new Date().toISOString(),
      pageTitle: document.title,
      pageURL: window.location.href,
      matchingKeys: {},
    };

    // 매칭된 키와 번역 정보 추가
    Array.from(results.keys)
      .sort()
      .forEach((key) => {
        exportData.matchingKeys[key] = {
          translations: {},
          matchedTexts: results.keyToTexts[key] || [],
        };

        // 각 언어별 번역 추가
        Object.entries(translations).forEach(([langCode, langData]) => {
          exportData.matchingKeys[key].translations[langCode] =
            langData[key] || "(No translation)";
        });
      });

    // 파일로 다운로드
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });

    // 파일명 생성 (페이지 제목 + 날짜)
    const pageTitle = document.title
      .replace(/[^a-z0-9]/gi, "_")
      .substring(0, 30);
    const dateStr = new Date().toISOString().split("T")[0];
    const fileName = `translation_keys_${pageTitle}_${dateStr}.json`;

    // 다운로드 링크 생성 및 클릭
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(dataBlob);
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    // 사용자에게 알림
    alert("번역 키 정보가 파일로 다운로드되었습니다.");
  } catch (error) {
    console.error("Error exporting results:", error);
    alert("결과 내보내기 중 오류가 발생했습니다.");
  }
}

// 확장 프로그램 팝업으로부터 메시지 수신
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message.action);

  if (message.action === "updateTranslations") {
    console.log(
      "Updating translations in content script:",
      Object.keys(message.translations)
    );
    translations = message.translations;

    // 응답 보내기
    if (sendResponse) {
      sendResponse({
        success: true,
        message: "번역 데이터가 업데이트되었습니다.",
      });
    }

    // 즉시 처리
    setTimeout(() => {
      processPage();

      // 1초 후 다시 시도 (페이지가 완전히 로드되지 않았을 경우를 대비)
      setTimeout(() => {
        processPage();
      }, 1000);
    }, 100);

    return true; // 비동기 응답을 위해 true 반환
  } else if (message.action === "processPage") {
    processPage();
    if (sendResponse) {
      sendResponse({ success: true });
    }
    return true;
  } else if (message.action === "clearTranslations") {
    translations = null;
    // 패널이 열려있으면 닫기
    const existingPanel = document.getElementById("i18n-translation-panel");
    if (existingPanel) {
      document.body.removeChild(existingPanel);
    }
    if (sendResponse) {
      sendResponse({ success: true });
    }
    return true;
  }

  return false;
});

// 페이지 로드 시 저장된 번역 데이터 불러오기
chrome.storage.local.get("translations", (data) => {
  console.log(
    "Loading translations from storage:",
    data.translations ? Object.keys(data.translations) : "none"
  );

  if (data.translations) {
    translations = data.translations;
    console.log("Translation data loaded:", Object.keys(translations));

    // 페이지가 로드되었는지 확인하고 적용
    if (
      document.readyState === "complete" ||
      document.readyState === "interactive"
    ) {
      setTimeout(() => {
        processPage();
        // 1초 후 다시 시도 (완전히 로드되지 않았을 수 있음)
        setTimeout(() => {
          processPage();
        }, 1000);
      }, 500);
    } else {
      // 페이지 로드 완료시 처리
      window.addEventListener("load", () => {
        setTimeout(() => {
          processPage();
          // 로드 이후 1초 후 다시 시도
          setTimeout(() => {
            processPage();
          }, 1000);
        }, 500);
      });
    }
  }
});
