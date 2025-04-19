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

// URL 타입 변경 이벤트 처리
function setupURLTypeHandlers(newInput) {
  const urlTypeSelect = newInput.querySelector(".url-type");
  const urlSingleDiv = newInput.querySelector(".url-single");
  const urlGithubDiv = newInput.querySelector(".url-github");

  if (!urlTypeSelect) return;

  urlTypeSelect.addEventListener("change", function () {
    const selectedValue = this.value;

    if (selectedValue === "single") {
      urlSingleDiv.style.display = "flex";
      urlGithubDiv.style.display = "none";
    } else if (selectedValue === "github") {
      urlSingleDiv.style.display = "none";
      urlGithubDiv.style.display = "block";
    }
  });
}

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
  const urlTypeSelect = newInput.querySelector(".url-type");
  const urlSingleDiv = newInput.querySelector(".url-single");
  const urlGithubDiv = newInput.querySelector(".url-github");
  const githubFetchBtn = newInput.querySelector(".github-fetch-btn");

  // URL 타입 변경 핸들러 설정
  setupURLTypeHandlers(newInput);

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

        // URL에서 데이터 가져오기
        chrome.runtime.sendMessage(
          { action: "fetchJSON", url: url },
          (response) => {
            if (response.success) {
              // 메모리에 데이터 저장
              const langCode = langCodeInput.value.trim();
              if (langCode) {
                // 전역 데이터에 직접 저장
                translationsData[langCode] = response.data;

                // 설정 저장
                updateLanguageSettings(langCode, url, "url");

                // UI 업데이트
                fileNameDisplay.textContent = url;
                fileNameDisplay.classList.add("file-selected");
                showStatus(
                  `${langCode} 데이터를 URL에서 불러왔습니다.`,
                  "success"
                );

                // 번역 목록 업데이트
                displayTranslations();
              }
            } else {
              fileNameDisplay.textContent = "URL 오류";
              showStatus(`URL 오류: ${response.error}`, "error");
            }
          }
        );
      } catch (error) {
        console.error("URL 데이터 로드 오류:", error);
        fileNameDisplay.textContent = "URL 오류";
        showStatus(`URL 오류: ${error.message}`, "error");
      }
    });
  }

  // GitHub 폴더 가져오기 버튼 이벤트
  if (githubFetchBtn) {
    githubFetchBtn.addEventListener("click", function () {
      const owner = newInput.querySelector(".github-owner").value.trim();
      const repo = newInput.querySelector(".github-repo").value.trim();
      const path = newInput.querySelector(".github-path").value.trim();
      const branch =
        newInput.querySelector(".github-branch").value.trim() || "main";

      if (!owner || !repo || !path) {
        showStatus("GitHub 저장소 정보를 모두 입력해주세요.", "error");
        return;
      }

      fileNameDisplay.textContent = "GitHub 폴더 불러오는 중...";

      // GitHub 폴더 내용 가져오기
      chrome.runtime.sendMessage(
        {
          action: "fetchGitHubFolder",
          owner,
          repo,
          path,
          branch,
        },
        (response) => {
          if (response.success && response.files && response.files.length > 0) {
            // 발견된 JSON 파일 목록 표시
            showStatus(
              `${response.files.length}개의 JSON 파일을 발견했습니다.`,
              "success"
            );

            // JSON 파일 로드
            chrome.runtime.sendMessage(
              {
                action: "loadFolderJSON",
                files: response.files,
              },
              (loadResponse) => {
                if (loadResponse.success) {
                  const langCode = langCodeInput.value.trim();
                  const filesData = loadResponse.data;

                  // 첫 번째 파일의 데이터를 기본으로 사용
                  let combinedData = {};

                  // 모든 파일의 데이터 병합
                  filesData.forEach((fileData) => {
                    combinedData = { ...combinedData, ...fileData.data };
                  });

                  // 데이터 저장
                  translationsData[langCode] = combinedData;

                  // 설정 저장 (GitHub URL로)
                  const repoUrl = `https://github.com/${owner}/${repo}/tree/${branch}/${path}`;
                  updateLanguageSettings(langCode, repoUrl, "github");

                  // UI 업데이트
                  fileNameDisplay.textContent = repoUrl;
                  fileNameDisplay.classList.add("file-selected");

                  // 번역 목록 업데이트
                  displayTranslations();

                  showStatus(
                    `${langCode} 데이터를 GitHub에서 불러왔습니다.`,
                    "success"
                  );
                } else {
                  fileNameDisplay.textContent = "JSON 로드 오류";
                  showStatus(`JSON 로드 오류: ${loadResponse.error}`, "error");
                }
              }
            );
          } else {
            fileNameDisplay.textContent = "GitHub 폴더 오류";
            showStatus(
              `GitHub 오류: ${response.error || "JSON 파일을 찾을 수 없습니다."}`,
              "error"
            );
          }
        }
      );
    });
  }

  // 삭제 버튼 이벤트
  removeBtn.addEventListener("click", function () {
    const langCodeToRemove = langCodeInput.value.trim();

    // 언어 입력 요소 삭제
    newInput.remove();
    updateLanguageInputs();

    // 즉시 변경사항 적용 (언어를 삭제하는 경우)
    if (langCodeToRemove && translationsData[langCodeToRemove]) {
      // 해당 언어 데이터 삭제
      delete translationsData[langCodeToRemove];

      // 저장된 설정 가져오기
      chrome.storage.local.get(["languageSettings"], (data) => {
        let settings = data.languageSettings || [];
        settings = settings.filter(
          (setting) => setting.langCode !== langCodeToRemove
        );

        // 저장 및 UI 업데이트
        saveAllData(translationsData, settings);
      });
    }
  });

  languageFilesContainer.appendChild(newInput);
  updateLanguageInputs();
}

// 언어 입력 목록 업데이트
function updateLanguageInputs() {
  languageInputs = Array.from(
    languageFilesContainer.querySelectorAll(".language-input")
  ).map((input) => {
    return {
      element: input,
      langCodeInput: input.querySelector(".lang-code"),
      fileInput: input.querySelector(".lang-file"),
      fileNameDisplay: input.querySelector(".file-name"),
    };
  });
}

// 모든 데이터 저장 (translations + languageSettings)
function saveAllData(translations, settings, callback) {
  console.log("저장 중...", {
    translations: Object.keys(translations),
    settings,
  });

  chrome.storage.local.set(
    {
      translations: translations,
      languageSettings: settings,
    },
    () => {
      // 전역 변수 업데이트
      translationsData = translations;

      // UI 업데이트
      displayTranslations();

      // 컨텐츠 스크립트에 메시지 전송
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "updateTranslations",
            translations: translations,
          });
        }
      });

      // 콜백 실행 (있는 경우)
      if (callback) callback();
    }
  );
}

// 저장된 설정 로드
function loadSavedSettings() {
  // 입력 영역 초기화
  languageFilesContainer.innerHTML = "";

  chrome.storage.local.get(["translations", "languageSettings"], (data) => {
    console.log("로드된 데이터:", data);

    // 전역 변수에 데이터 할당
    translationsData = data.translations || {};
    const savedSettings = data.languageSettings || [];

    console.log("로드된 translations:", Object.keys(translationsData));
    console.log("로드된 settings:", savedSettings);

    // 1. 설정 기반으로 입력 필드 생성
    if (savedSettings.length > 0) {
      savedSettings.forEach(({ langCode, fileName, sourceType = "file" }) => {
        addLanguageInput(langCode, fileName, sourceType);
      });
    }
    // 2. translations 데이터만 있는 경우
    else if (Object.keys(translationsData).length > 0) {
      Object.keys(translationsData).forEach((langCode) => {
        addLanguageInput(langCode, `${langCode}.json`);
      });
    }
    // 3. 아무것도 없으면 기본값
    else {
      addLanguageInput("ko");
      addLanguageInput("en");
    }

    // 입력 필드 정보 업데이트
    updateLanguageInputs();

    // 번역 목록 표시
    displayTranslations();
  });
}

// '언어 추가' 버튼 클릭 이벤트
addLanguageBtn.addEventListener("click", () => {
  addLanguageInput();
});

// '초기화' 버튼 클릭 이벤트
resetButton.addEventListener("click", () => {
  if (confirm("모든 데이터를 초기화하시겠습니까?")) {
    chrome.storage.local.clear(() => {
      translationsData = {};
      languageFilesContainer.innerHTML = "";
      translationList.innerHTML = "";
      addLanguageInput("ko");
      addLanguageInput("en");
      showStatus("모든 데이터가 초기화되었습니다.", "success");
    });
  }
});

// 파일 업로드 처리
uploadButton.addEventListener("click", async () => {
  try {
    // 입력 필드 정보 갱신
    updateLanguageInputs();

    // 입력 유효성 검사
    const invalidInputs = languageInputs.filter((input) => {
      const langCode = input.langCodeInput.value.trim();
      return !langCode;
    });

    if (invalidInputs.length > 0) {
      showStatus("모든 언어 코드를 입력해주세요.", "error");
      return;
    }

    // 중복된 언어 코드 확인
    const langCodes = languageInputs.map((input) =>
      input.langCodeInput.value.trim()
    );
    if (new Set(langCodes).size !== langCodes.length) {
      showStatus("언어 코드가 중복되었습니다.", "error");
      return;
    }

    // 새로운 데이터 객체와 설정
    const newTranslationsData = { ...translationsData }; // 기존 데이터 복사
    const newSettings = [];
    let loadedCount = 0;
    let unchangedCount = 0;
    let errorOccurred = false;

    // 각 언어 입력 처리
    for (const input of languageInputs) {
      const langCode = input.langCodeInput.value.trim();
      const hasNewFile = input.fileInput.files.length > 0;
      const fileElement = input.fileNameDisplay;

      console.log(`처리 중: ${langCode}, 새 파일: ${hasNewFile}`);

      // 새 파일 선택됨
      if (hasNewFile) {
        try {
          const file = input.fileInput.files[0];
          const content = await readFileAsync(file);
          const parsedData = JSON.parse(content);

          // 데이터 저장
          newTranslationsData[langCode] = parsedData;
          loadedCount++;

          // 설정 저장
          newSettings.push({
            langCode: langCode,
            fileName: file.name,
          });

          // UI 업데이트
          fileElement.textContent = file.name;
          fileElement.classList.add("file-selected");
        } catch (error) {
          showStatus(`${langCode} 파일 처리 오류: ${error.message}`, "error");
          console.error(`${langCode} 파일 처리 오류:`, error);
          errorOccurred = true;
          break;
        }
      }
      // 기존 데이터 있음
      else if (translationsData[langCode]) {
        // 기존 데이터 유지
        newSettings.push({
          langCode: langCode,
          fileName: fileElement.textContent || `${langCode}.json`,
        });
        unchangedCount++;
      }
      // 새 언어인데 파일 없음
      else {
        showStatus(`${langCode} 언어 파일을 선택해주세요.`, "error");
        errorOccurred = true;
        break;
      }
    }

    // 오류 발생 시 중단
    if (errorOccurred) return;

    // 모든 언어 처리 완료, 데이터 저장
    saveAllData(newTranslationsData, newSettings, () => {
      // 상태 메시지 표시
      let statusMsg = "";
      if (loadedCount > 0 && unchangedCount > 0) {
        statusMsg = `${loadedCount}개 파일 업로드, ${unchangedCount}개 파일 유지됨`;
      } else if (loadedCount > 0) {
        statusMsg = `${loadedCount}개 파일이 업로드되었습니다.`;
      } else {
        statusMsg = "기존 번역 데이터가 유지되었습니다.";
      }
      showStatus(statusMsg, "success");

      // 로드 결과 확인
      console.log("최종 결과:", {
        translations: Object.keys(newTranslationsData),
        settings: newSettings,
      });
    });
  } catch (error) {
    console.error("업로드 처리 오류:", error);
    showStatus("업로드 처리 오류: " + error.message, "error");
  }
});

// 파일 비동기 읽기 함수
function readFileAsync(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
}

// 상태 메시지 표시
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = "status-message " + type;

  // 3초 후 메시지 숨기기
  setTimeout(() => {
    statusMessage.className = "status-message";
  }, 3000);
}

// 번역 데이터 표시
function displayTranslations() {
  translationList.innerHTML = "";

  if (!translationsData || Object.keys(translationsData).length === 0) {
    translationList.innerHTML =
      "<div class='no-translations'>로드된 번역 데이터가 없습니다.</div>";
    return;
  }

  // 업로드 상태 표시
  const statusInfo = document.createElement("div");
  statusInfo.className = "upload-status";
  statusInfo.textContent = `${Object.keys(translationsData).length}개 파일 로드됨, ${
    translationList.querySelectorAll(".translation-item").length
  }개 파일 유지됨`;
  translationList.appendChild(statusInfo);

  // 첫 번째 언어의 키를 기준으로 표시
  const firstLangCode = Object.keys(translationsData)[0];
  if (!firstLangCode) return;

  const keys = Object.keys(translationsData[firstLangCode]);

  keys.sort().forEach((key) => {
    const itemElement = document.createElement("div");
    itemElement.className = "translation-item";

    let html = `<div class="key">${key}</div>`;

    // 각 언어별 번역값 표시
    Object.entries(translationsData).forEach(([langCode, translations]) => {
      const value = translations[key] || "(번역 없음)";
      html += `
        <div class="translation">
          <span class="language">${langCode}:</span>
          <span class="value">${value}</span>
        </div>
      `;
    });

    itemElement.innerHTML = html;
    translationList.appendChild(itemElement);
  });
}

// 언어 설정 업데이트 (통합 함수)
function updateLanguageSettings(langCode, fileName, sourceType = "file") {
  chrome.storage.local.get(["languageSettings"], (data) => {
    let settings = data.languageSettings || [];

    // 기존 설정 제거
    settings = settings.filter((s) => s.langCode !== langCode);

    // 새 설정 추가
    settings.push({
      langCode: langCode,
      fileName: fileName,
      sourceType: sourceType,
    });

    // 저장
    saveAllData(translationsData, settings);
  });
}

// 페이지 로드 시 설정 로드
document.addEventListener("DOMContentLoaded", loadSavedSettings);
