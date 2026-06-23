# How to Update and Deploy This Site

이 문서는 사이트를 수정한 뒤 배포된 사이트까지 최신화하는 가장 쉬운 절차입니다.

공유 주소:

```text
https://met-motion-gallery.vercel.app
```

GitHub 저장소:

```text
https://github.com/adeht123/met-motion-gallery
```

## 핵심 원리

이 프로젝트는 GitHub와 Vercel이 연결되어 있습니다.

로컬 폴더에서 수정한 뒤 GitHub에 `git push`하면, Vercel이 자동으로 새 버전을 배포합니다. 공유 주소는 바뀌지 않습니다.

```text
로컬 수정 -> git commit -> git push -> Vercel 자동 배포 -> 같은 URL이 최신화됨
```

## 매번 하는 순서

1. 프로젝트 폴더로 이동합니다.

```powershell
cd "C:\Users\dldbs\Downloads\met-motion-gallery\met-motion-gallery"
```

2. 로컬 서버를 켜서 수정 내용을 확인합니다.

```powershell
npm start
```

브라우저에서 엽니다.

```text
http://localhost:4173
```

서버를 끄려면 터미널에서 `Ctrl + C`를 누릅니다.

3. 파일을 수정합니다.

자주 수정하는 파일:

```text
index.html        화면 구조
styles.css        디자인
src/main.js       주요 화면 동작
src/metApi.js     MET API 요청 로직
assets/           이미지와 아이콘
```

4. 테스트를 실행합니다.

```powershell
npm test
```

전부 통과해야 배포하는 것이 안전합니다.

5. Git에 변경사항을 기록합니다.

```powershell
git status
git add .
git commit -m "수정 내용 짧게 설명"
```

예시:

```powershell
git commit -m "Update gallery card spacing"
```

6. GitHub에 올립니다.

```powershell
git push
```

이 명령을 실행하면 Vercel 자동 배포가 시작됩니다.

## 배포 확인 방법

1. 1분 정도 기다립니다.
2. 공유 주소를 새로고침합니다.

```text
https://met-motion-gallery.vercel.app
```

3. API도 확인하고 싶으면 아래 주소를 엽니다.

```text
https://met-motion-gallery.vercel.app/api/met/departments
```

JSON 데이터가 보이면 API 프록시도 정상입니다.

터미널에서 확인하려면:

```powershell
npx vercel@latest ls met-motion-gallery
```

가장 위 deployment가 `Ready`이면 배포가 완료된 상태입니다.

## 자주 생기는 상황

### `git status`에 파일이 많이 보일 때

수정한 파일 목록입니다. 정상입니다.

내용을 저장하려면:

```powershell
git add .
git commit -m "수정 내용"
git push
```

### `nothing to commit`이 나올 때

Git이 볼 때 바뀐 파일이 없다는 뜻입니다. 이미 커밋했거나 저장하지 않았을 수 있습니다.

### `npm test`가 실패할 때

배포하지 말고 실패 내용을 먼저 고칩니다. 실패한 상태로 push하면 깨진 버전이 배포될 수 있습니다.

### `localhost:4173`이 안 열릴 때

이미 다른 서버가 그 포트를 쓰고 있을 수 있습니다. 다른 포트로 실행합니다.

```powershell
$env:PORT="4174"; npm start
```

브라우저에서 엽니다.

```text
http://localhost:4174
```

### 급하게 수동 배포해야 할 때

보통은 `git push`만 하면 됩니다. 그래도 Vercel에 직접 배포해야 하면:

```powershell
npx vercel@latest --prod
```

## Codex에게 맡길 때

수정 작업을 Codex에게 맡길 때는 이렇게 말하면 됩니다.

```text
이 사이트에서 [원하는 변경] 해주고, 테스트 후 GitHub에 push해서 자동 배포까지 확인해줘.
```

Codex가 해야 할 일:

```text
수정 -> npm test -> git commit -> git push -> Vercel Ready 확인 -> 사이트 확인
```
