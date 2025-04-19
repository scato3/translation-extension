// 익스텐션이 설치될 때 실행
chrome.runtime.onInstalled.addListener(() => {
  console.log("i18n Translator 확장 프로그램이 설치되었습니다.");
});

// 브라우저 액션 클릭 이벤트
chrome.action.onClicked.addListener((tab) => {
  // 액티브 탭에 메시지 전송
  chrome.tabs.sendMessage(tab.id, { action: "processPage" });
});

// 컨텍스트 메뉴 생성
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "process-page",
    title: "현재 페이지의 i18n 키 분석",
    contexts: ["page"],
  });
});

// 컨텍스트 메뉴 클릭 이벤트
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "process-page") {
    // 액티브 탭에 메시지 전송
    chrome.tabs.sendMessage(tab.id, { action: "processPage" });
  }
});

// 탭이 업데이트될 때 (페이지가 로드될 때) 아이콘 활성화
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    chrome.action.enable(tabId);
  }
});

// 확장 프로그램 설치/업데이트 시 실행
chrome.runtime.onInstalled.addListener(() => {
  console.log("i18n Translator 확장 프로그램이 설치/업데이트되었습니다.");
});

// 메시지 핸들러
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // JSON을 가져오는 요청 처리
  if (message.action === "fetchJSON") {
    fetch(message.url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        sendResponse({ success: true, data: data });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });

    // 비동기 응답을 위해 true 반환
    return true;
  }

  // GitHub 폴더 내용을 가져오는 요청 처리
  if (message.action === "fetchGitHubFolder") {
    const { owner, repo, path, branch = "main" } = message;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

    fetch(apiUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        // JSON 파일 필터링
        const jsonFiles = data.filter(
          (item) => item.type === "file" && item.name.endsWith(".json")
        );
        sendResponse({ success: true, files: jsonFiles });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }

  // 폴더 내 모든 JSON 파일을 로드하는 요청 처리
  if (message.action === "loadFolderJSON") {
    const fetchPromises = message.files.map((file) =>
      fetch(file.download_url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => ({
          name: file.name.replace(".json", ""),
          data: data,
        }))
    );

    Promise.all(fetchPromises)
      .then((results) => {
        sendResponse({ success: true, data: results });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }
});
