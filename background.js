// i18n 번역기 배경 스크립트

// 번역 데이터
let translations = {};

// 설치 시 초기화
chrome.runtime.onInstalled.addListener(() => {
  ("i18n 번역기가 설치되었습니다.");

  // 저장된 번역 데이터 불러오기
  loadTranslations();
});

// 시작 시 데이터 불러오기
loadTranslations();

// 메시지 리스너 설정
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  "배경 스크립트에서 수신한 메시지:", message.action;

  // 핑 응답 (연결 확인용)
  if (message.action === "ping") {
    ("핑 요청 수신됨");
    sendResponse({ success: true, message: "배경 스크립트 연결됨" });
    return true;
  }

  // 번역 데이터 요청
  if (message.action === "getTranslations") {
    "번역 데이터 요청 수신됨", Object.keys(translations);
    sendResponse({ translations: translations });
    return true;
  }

  // 번역 데이터 업데이트
  if (message.action === "updateTranslations") {
    if (!message.translations) {
      sendResponse({
        success: false,
        error: "번역 데이터가 제공되지 않았습니다.",
      });
      return true;
    }

    translations = message.translations;
    saveTranslations(translations);

    // 모든 탭에 업데이트 알림
    broadcastToAllTabs();

    sendResponse({ success: true });
    return true;
  }

  // 번역 데이터 초기화
  if (message.action === "clearTranslations") {
    translations = {};
    chrome.storage.local.remove("translations", () => {
      ("번역 데이터가 초기화되었습니다.");

      // 모든 탭에 알림
      broadcastToAllTabs();

      sendResponse({ success: true });
    });
    return true;
  }

  return false; // 비동기 응답이 필요 없는 경우
});

// 저장된 번역 데이터 불러오기
function loadTranslations() {
  chrome.storage.local.get("translations", (result) => {
    if (chrome.runtime.lastError) {
      console.error("번역 데이터 로드 오류:", chrome.runtime.lastError);
      return;
    }

    if (result.translations) {
      translations = result.translations;
      "번역 데이터 로드됨:", Object.keys(translations);
    } else {
      ("저장된 번역 데이터가 없습니다.");
    }
  });
}

// 번역 데이터 저장
function saveTranslations(data) {
  chrome.storage.local.set({ translations: data }, () => {
    if (chrome.runtime.lastError) {
      console.error("번역 데이터 저장 오류:", chrome.runtime.lastError);
    } else {
      "번역 데이터 저장됨:", Object.keys(data);
    }
  });
}

// 모든 탭에 메시지 전송
function broadcastToAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      // HTTPS 페이지에만 메시지 전송 (보안 정책으로 인해)
      if (
        tab.url &&
        (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
      ) {
        chrome.tabs.sendMessage(
          tab.id,
          {
            action: "updateTranslations",
            translations: translations,
          },
          (response) => {
            // 응답 오류 무시 (콘텐츠 스크립트 자체가 아직 로드되지 않은 페이지일 수 있음)
            if (chrome.runtime.lastError) {
              // 오류 무시
            }
          }
        );
      }
    });
  });
}
