// 번역 데이터와 언어 설정
let translationsData = {};

// DOM 요소 참조
const languageFilesContainer = document.getElementById(
  "language-files-container"
);
const addLanguageBtn = document.getElementById("add-language-btn");
const uploadButton = document.getElementById("upload-btn");
const resetButton = document.getElementById("reset-btn");
const statusMessage = document.getElementById("status-message");
const translationList = document.getElementById("translation-list");
const languageInputTemplate = document.getElementById(
  "language-input-template"
);
let languageInputs = [];

// 언어 입력 추가
function addLanguageInput(langCode = "", fileName = "", sourceType = "file") {
  const newInput = document
    .importNode(languageInputTemplate.content, true)
    .querySelector(".language-input");

  const langCodeInput = newInput.querySelector(".lang-code");
  const fileInput = newInput.querySelector(".lang-file");
  const fileNameDisplay = newInput.querySelector(".file-name");
  const removeBtn = newInput.querySelector(".remove-lang-btn");
  const tabs = newInput.querySelectorAll(".tab");
  const tabContents = newInput.querySelectorAll(".tab-content");

  // URL 관련 요소
  const urlInput = newInput.querySelector(".url-input");
  const fetchBtn = newInput.querySelector(".fetch-btn");

  // 언어 코드 설정
  if (langCode) {
    langCodeInput.value = langCode;
  }

  // 파일명/소스 설정
  if (fileName) {
    fileNameDisplay.textContent = fileName;
    fileNameDisplay.classList.add("file-selected");

    // URL인 경우 URL 탭 활성화
    if (sourceType === "url") {
      // 탭 전환
      tabs.forEach((tab) => {
        if (tab.getAttribute("data-target") === "url-tab") {
          tab.click(); // 클릭 이벤트 발생시켜 탭 전환
        }
      });

      // URL 입력
      if (urlInput && fileName.startsWith("http")) {
        urlInput.value = fileName;
      }
    }
  }

  // 탭 클릭 이벤트
  tabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      const targetTab = this.getAttribute("data-target");

      // 모든 탭 비활성화
      tabs.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      // 선택된 탭 활성화
      this.classList.add("active");
      newInput.querySelector("." + targetTab).classList.add("active");

      // URL 탭일 때는 URL의 X 버튼만 표시
      if (targetTab === "url-tab") {
        if (fileRemoveBtn) fileRemoveBtn.style.display = "none";
        if (urlRemoveBtn) urlRemoveBtn.style.display = "flex";
      }
      // 파일 탭일 때는 파일의 X 버튼만 표시
      else {
        if (fileRemoveBtn) fileRemoveBtn.style.display = "flex";
        if (urlRemoveBtn) urlRemoveBtn.style.display = "none";
      }
    });
  });

  // 파일 선택 이벤트
  fileInput.addEventListener("change", function () {
    if (this.files.length > 0) {
      fileNameDisplay.textContent = this.files[0].name;
      fileNameDisplay.classList.add("file-selected");
    } else {
      fileNameDisplay.textContent = "선택된 파일 없음";
      fileNameDisplay.classList.remove("file-selected");
    }
  });

  // URL 가져오기 버튼 이벤트
  if (fetchBtn) {
    fetchBtn.addEventListener("click", async function () {
      const url = urlInput.value.trim();
      if (!url) {
        showStatus("URL을 입력해주세요.", "error");
        return;
      }

      try {
        fileNameDisplay.textContent = "불러오는 중...";
        showStatus("URL에서 데이터를 가져오는 중...", "info");

        // fetch API를 사용하여 직접 URL에서 데이터 가져오기
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP 오류: ${response.status}`);
        }

        const data = await response.json();

        // 언어 코드 확인
        const langCode = langCodeInput.value.trim();
        if (!langCode) {
          showStatus("언어 코드를 입력해주세요.", "error");
          fileNameDisplay.textContent = "언어 코드 필요";
          return;
        }

        // 데이터 저장
        translationsData[langCode] = data;

        // 설정 저장
        updateLanguageSettings(langCode, url, "url");

        // UI 업데이트
        fileNameDisplay.textContent = url;
        fileNameDisplay.classList.add("file-selected");
        showStatus(`${langCode} 데이터를 URL에서 불러왔습니다.`, "success");

        // 번역 목록 업데이트
        displayTranslations();

        // 크롬 스토리지에 즉시 저장
        saveAllData(translationsData, null, function (success) {
          if (success) {
            console.log("URL에서 가져온 데이터가 스토리지에 저장되었습니다.");

            // 배경 스크립트에도 데이터 업데이트
            chrome.runtime.sendMessage({
              action: "updateTranslations",
              translations: translationsData,
            });

            // 현재 탭에도 적용
            applyToCurrentTab();
          }
        });
      } catch (error) {
        console.error("URL 데이터 로드 오류:", error);
        fileNameDisplay.textContent = "URL 오류";
        showStatus(`URL 오류: ${error.message}`, "error");
      }
    });
  }

  // 삭제 버튼 이벤트
  const fileRemoveBtn = newInput.querySelector(".file-remove-btn");
  const urlRemoveBtn = newInput.querySelector(".url-remove-btn");

  // 파일 탭 X 버튼 이벤트
  if (fileRemoveBtn) {
    fileRemoveBtn.addEventListener("click", function () {
      const langCode = langCodeInput.value.trim();
      if (langCode && translationsData[langCode]) {
        delete translationsData[langCode];
      }
      newInput.remove();

      // 번역 목록 업데이트
      displayTranslations();
    });
  }

  // URL 탭 X 버튼 이벤트
  if (urlRemoveBtn) {
    urlRemoveBtn.addEventListener("click", function () {
      const langCode = langCodeInput.value.trim();
      if (langCode && translationsData[langCode]) {
        delete translationsData[langCode];
      }
      newInput.remove();

      // 번역 목록 업데이트
      displayTranslations();
    });
  }

  // 초기 상태에서 URL X 버튼 숨김 (파일 탭이 기본)
  if (urlRemoveBtn) urlRemoveBtn.style.display = "none";

  // 컨테이너에 추가
  languageFilesContainer.appendChild(newInput);
  languageInputs.push(newInput);

  return newInput;
}

// 언어 입력 초기화
function updateLanguageInputs() {
  // 기존 입력 폼 제거
  languageFilesContainer.innerHTML = "";
  languageInputs = [];

  // 저장된 설정에서 언어 입력 폼 생성
  chrome.storage.local.get(["languageSettings"], function (result) {
    const settings = result.languageSettings || {};

    if (Object.keys(settings).length === 0) {
      // 기본 언어 입력 폼 추가
      addLanguageInput();
    } else {
      // 저장된 설정으로 언어 입력 폼 추가
      for (const langCode in settings) {
        const { fileName, sourceType } = settings[langCode];
        addLanguageInput(langCode, fileName, sourceType);
      }
    }
  });
}

// 모든 데이터 저장
function saveAllData(translations, settings, callback) {
  // settings가 null이면 UI에서 현재 설정 가져오기
  if (settings === null) {
    settings = {};
    for (const input of languageInputs) {
      const langCodeInput = input.querySelector(".lang-code");
      const langCode = langCodeInput.value.trim();

      if (!langCode) continue;

      const activeTab = input.querySelector(".tab.active");
      const isFileTab = activeTab.getAttribute("data-target") === "file-tab";
      const fileNameDisplay = input.querySelector(".file-name");
      const urlInput = input.querySelector(".url-input");

      settings[langCode] = {
        fileName: isFileTab
          ? fileNameDisplay.textContent
          : urlInput.value.trim(),
        sourceType: isFileTab ? "file" : "url",
      };
    }
  }

  console.log("저장 중인 설정:", settings);

  chrome.storage.local.set(
    {
      translations: translations,
      languageSettings: settings,
    },
    function () {
      if (chrome.runtime.lastError) {
        console.error("저장 오류:", chrome.runtime.lastError);
        showStatus("저장 중 오류가 발생했습니다.", "error");
        if (callback) callback(false);
      } else {
        console.log("번역 데이터와 설정 저장 완료");
        if (callback) callback(true);
      }
    }
  );
}

// 저장된 설정 로드
function loadSavedSettings() {
  chrome.storage.local.get(
    ["translations", "languageSettings"],
    function (result) {
      const savedTranslations = result.translations || {};

      // 번역 데이터 로드
      translationsData = savedTranslations;

      // UI 업데이트
      updateLanguageInputs();
      displayTranslations();

      if (Object.keys(savedTranslations).length > 0) {
        showStatus("저장된 번역 데이터를 불러왔습니다.", "success");
      }
    }
  );
}

// 번역 데이터 적용
function applyTranslations() {
  // 언어 설정 수집
  const settings = {};
  const promises = [];

  // 각 언어 입력 폼 처리
  for (const input of languageInputs) {
    const langCodeInput = input.querySelector(".lang-code");
    const langCode = langCodeInput.value.trim();

    if (!langCode) continue;

    const fileInput = input.querySelector(".lang-file");
    const activeTab = input.querySelector(".tab.active");
    const isFileTab = activeTab.getAttribute("data-target") === "file-tab";
    const urlInput = input.querySelector(".url-input");

    if (isFileTab && fileInput.files.length > 0) {
      // 파일에서 데이터 로드
      const file = fileInput.files[0];
      const promise = readFileAsync(file)
        .then((data) => {
          try {
            const jsonData = JSON.parse(data);
            translationsData[langCode] = jsonData;
            settings[langCode] = {
              fileName: file.name,
              sourceType: "file",
            };
            return true;
          } catch (e) {
            showStatus(`${langCode} 파일 파싱 오류: ${e.message}`, "error");
            return false;
          }
        })
        .catch((error) => {
          showStatus(`${langCode} 파일 읽기 오류: ${error.message}`, "error");
          return false;
        });

      promises.push(promise);
    } else if (!isFileTab && urlInput.value.trim()) {
      // URL 데이터는 이미 처리되었으므로 설정만 저장
      settings[langCode] = {
        fileName: urlInput.value.trim(),
        sourceType: "url",
      };
    } else if (translationsData[langCode]) {
      // 기존 데이터가 있는 경우 설정 유지
      const fileNameDisplay = input.querySelector(".file-name");
      settings[langCode] = {
        fileName: fileNameDisplay.textContent,
        sourceType: isFileTab ? "file" : "url",
      };
    }
  }

  // 모든 파일 처리 완료 후 저장
  Promise.all(promises)
    .then(() => {
      if (Object.keys(translationsData).length === 0) {
        showStatus("적용할 번역 데이터가 없습니다.", "error");
        return;
      }

      // 처리 완료 후 번역 목록 즉시 업데이트
      displayTranslations();

      console.log("Chrome 스토리지에 번역 데이터 저장 시도 중...");

      // 배경 스크립트 연결 시도 및 저장
      saveAndApplyTranslations(settings);
    })
    .catch((error) => {
      showStatus(`오류: ${error.message}`, "error");
    });
}

// 번역 데이터 저장 및 적용
function saveAndApplyTranslations(settings) {
  // 스토리지에 저장
  saveAllData(translationsData, settings, function (success) {
    if (success) {
      console.log("번역 데이터가 스토리지에 저장되었습니다.");

      // 번역 목록 다시 한번 업데이트 (스토리지 저장 후)
      displayTranslations();

      // 배경 스크립트 연결 시도
      tryConnectToBackground(0);
    } else {
      showStatus("번역 데이터 저장 실패", "error");
    }
  });
}

// 배경 스크립트 연결 시도
function tryConnectToBackground(attemptCount) {
  const maxAttempts = 2;
  console.log(`배경 스크립트 연결 시도 ${attemptCount + 1}/${maxAttempts + 1}`);

  // 언어 설정 수집
  const settings = {};
  for (const input of languageInputs) {
    const langCodeInput = input.querySelector(".lang-code");
    const langCode = langCodeInput.value.trim();

    if (!langCode) continue;

    const activeTab = input.querySelector(".tab.active");
    const isFileTab = activeTab.getAttribute("data-target") === "file-tab";
    const fileNameDisplay = input.querySelector(".file-name");
    const urlInput = input.querySelector(".url-input");

    settings[langCode] = {
      fileName: isFileTab ? fileNameDisplay.textContent : urlInput.value.trim(),
      sourceType: isFileTab ? "file" : "url",
    };
  }

  // 배경 스크립트 연결 테스트
  chrome.runtime.sendMessage({ action: "ping" }, function (response) {
    if (chrome.runtime.lastError || !response || !response.success) {
      console.error("배경 스크립트 연결 실패:", chrome.runtime.lastError);

      // 최대 시도 횟수를 초과하지 않았으면 재시도
      if (attemptCount < maxAttempts) {
        setTimeout(() => tryConnectToBackground(attemptCount + 1), 500);
      } else {
        // 최대 시도 횟수 초과 시 현재 탭에만 적용
        showStatus(
          "배경 스크립트 연결 실패. 현재 탭에만 적용합니다.",
          "warning"
        );

        // 현재 활성 탭에만 적용
        applyToCurrentTab();
      }
    } else {
      // 연결 성공, 모든 탭에 적용
      console.log("배경 스크립트 연결 성공");
      saveAllData(translationsData, settings, function (success) {
        if (success) {
          showStatus("번역 데이터가 성공적으로 적용되었습니다.", "success");

          // 번역 데이터 업데이트 메시지 전송
          chrome.runtime.sendMessage({
            action: "updateTranslations",
            translations: translationsData,
          });
        } else {
          showStatus("번역 데이터 저장 실패. 현재 탭에만 적용합니다.", "error");
          applyToCurrentTab();
        }
      });
    }
  });
}

// 현재 탭에만 적용
function applyToCurrentTab() {
  console.log("현재 활성 탭에 번역 데이터 적용 시도");

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs.length > 0) {
      console.log("활성 탭 ID:", tabs[0].id);
      console.log("적용할 번역 데이터 키:", Object.keys(translationsData));

      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          action: "updateTranslations",
          translations: translationsData,
        },
        function (response) {
          if (chrome.runtime.lastError) {
            console.error(
              "현재 탭 메시지 전송 오류:",
              chrome.runtime.lastError
            );
            showStatus(
              "현재 탭에 데이터 적용 실패 - 페이지를 새로고침하세요",
              "error"
            );

            // 2초 후 다시 시도
            setTimeout(() => {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "updateTranslations",
                translations: translationsData,
              });
            }, 2000);
          } else if (response && response.success) {
            console.log("현재 탭에 데이터 적용 성공:", response);
            showStatus("현재 탭에 번역 데이터가 적용되었습니다.", "success");
          } else {
            console.warn("현재 탭 응답 없음, 다시 시도");
            // 응답이 없으면 다시 시도
            setTimeout(() => {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "updateTranslations",
                translations: translationsData,
              });
            }, 1000);
          }
        }
      );

      // 1초 후 processPage 메시지도 전송
      setTimeout(() => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "processPage" });
      }, 1000);
    } else {
      showStatus("활성 탭을 찾을 수 없습니다.", "error");
    }
  });
}

// 파일 비동기 읽기
function readFileAsync(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsText(file);
  });
}

// 상태 메시지 표시
function showStatus(message, type = "info") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.style.display = "block";

  // 메시지 유형에 따라 표시 시간 조정
  const timeout = type === "error" ? 5000 : type === "warning" ? 4000 : 3000;

  // 기존 타이머 제거
  if (statusMessage.timer) {
    clearTimeout(statusMessage.timer);
  }

  // 새 타이머 설정
  statusMessage.timer = setTimeout(() => {
    statusMessage.style.display = "none";
  }, timeout);
}

// 번역 목록 표시
function displayTranslations() {
  translationList.innerHTML = "";

  // 모든 언어의 번역 키 수집
  const allKeys = new Set();
  for (const langCode in translationsData) {
    Object.keys(translationsData[langCode]).forEach((key) => allKeys.add(key));
  }

  if (allKeys.size === 0) {
    translationList.innerHTML = "<p>등록된 번역이 없습니다.</p>";
    return;
  }

  // 각 키에 대한 번역 표시
  allKeys.forEach((key) => {
    const item = document.createElement("div");
    item.className = "translation-item";

    const keyElement = document.createElement("div");
    keyElement.className = "translation-key";
    keyElement.textContent = key;
    item.appendChild(keyElement);

    // 각 언어별 번역 표시
    for (const langCode in translationsData) {
      const value = translationsData[langCode][key];
      if (value) {
        const valueElement = document.createElement("div");
        valueElement.className = "translation-value";
        valueElement.innerHTML = `<span class="lang-label">${langCode}:</span> ${value}`;
        item.appendChild(valueElement);
      }
    }

    translationList.appendChild(item);
  });
}

// 언어 설정 업데이트
function updateLanguageSettings(langCode, fileName, sourceType = "file") {
  chrome.storage.local.get(["languageSettings"], function (result) {
    const settings = result.languageSettings || {};
    settings[langCode] = { fileName, sourceType };

    chrome.storage.local.set({ languageSettings: settings }, function () {
      if (chrome.runtime.lastError) {
        console.error("설정 저장 오류:", chrome.runtime.lastError);
      }
    });
  });
}

// 이벤트 리스너
document.addEventListener("DOMContentLoaded", function () {
  // 저장된 데이터 로드
  loadSavedSettings();

  // 언어 추가 버튼
  addLanguageBtn.addEventListener("click", function () {
    addLanguageInput();
  });

  // 파일 업로드 및 적용 버튼
  uploadButton.addEventListener("click", function () {
    applyTranslations();
  });

  // 초기화 버튼
  resetButton.addEventListener("click", function () {
    if (confirm("모든 번역 데이터를 초기화하시겠습니까?")) {
      // 스토리지 초기화
      chrome.storage.local.clear(function () {
        // UI 초기화
        translationsData = {};
        updateLanguageInputs();
        displayTranslations();
        showStatus("모든 데이터가 초기화되었습니다.", "info");

        // 배경 스크립트 초기화 메시지
        chrome.runtime.sendMessage({ action: "clearTranslations" });

        // 현재 탭 초기화
        chrome.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            if (tabs.length > 0) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "clearTranslations",
              });
            }
          }
        );
      });
    }
  });
});
