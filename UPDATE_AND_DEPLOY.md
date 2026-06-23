# 초보자용 수정/배포 가이드

이 문서는 이 사이트를 수정한 뒤, 다른 사람들이 보는 공개 사이트까지 최신 버전으로 바꾸는 방법입니다.

공개 사이트 주소:

```text
https://met-motion-gallery.vercel.app
```

GitHub 주소:

```text
https://github.com/adeht123/met-motion-gallery
```

## 아주 쉬운 전체 흐름

한 줄로 말하면 이렇습니다.

```text
내 컴퓨터에서 수정 -> GitHub에 올림 -> Vercel이 자동으로 공개 사이트를 업데이트
```

공개 사이트 주소는 계속 같습니다.

```text
https://met-motion-gallery.vercel.app
```

수정할 때마다 새 주소가 생기는 것이 아닙니다. 같은 주소의 내용만 최신 버전으로 바뀝니다.

## 용어를 쉽게 말하면

```text
Git
변경 기록을 남겨주는 도구입니다.

GitHub
내 코드를 인터넷에 백업해두는 곳입니다.

commit
"여기까지 저장"이라는 저장 지점입니다.

push
내 컴퓨터의 저장 지점을 GitHub에 업로드하는 것입니다.

Vercel
GitHub에 올라간 코드를 실제 웹사이트로 보여주는 서비스입니다.

deploy
공개 웹사이트에 새 버전을 반영하는 것입니다.
```

이 프로젝트는 GitHub와 Vercel이 이미 연결되어 있습니다.

그래서 보통은 `git push`만 하면 Vercel이 자동으로 배포합니다.

## 가장 중요한 공식

수정이 끝난 뒤에는 이 순서만 기억하면 됩니다.

```powershell
npm test
git add .
git commit -m "수정 내용 짧게 적기"
git push
```

뜻은 이렇습니다.

```text
npm test
사이트가 깨지지 않았는지 검사합니다.

git add .
이번에 바뀐 파일들을 저장 준비합니다.

git commit -m "..."
"여기까지 저장" 지점을 만듭니다.

git push
GitHub에 올립니다. 그러면 Vercel 자동 배포가 시작됩니다.
```

## 내가 직접 수정할 때

아래 순서대로 하면 됩니다.

### 1. 프로젝트 폴더로 이동

```powershell
cd "C:\Users\dldbs\Downloads\met-motion-gallery\met-motion-gallery"
```

### 2. 내 컴퓨터에서 사이트 열기

```powershell
npm start
```

브라우저에서 아래 주소를 엽니다.

```text
http://localhost:4173
```

`localhost`는 내 컴퓨터에서만 보이는 테스트용 주소입니다. 다른 사람에게 공유하는 주소가 아닙니다.

서버를 끄고 싶으면 터미널에서 `Ctrl + C`를 누릅니다.

### 3. 파일 수정

자주 수정하는 파일은 아래입니다.

```text
index.html        화면 뼈대
styles.css        디자인
src/main.js       주요 동작
src/metApi.js     MET API 요청
assets/           이미지, 아이콘 같은 파일
```

### 4. 문제가 없는지 검사

```powershell
npm test
```

실패하면 아직 올리지 않는 것이 좋습니다. 먼저 오류를 고치고 다시 테스트합니다.

### 5. 바뀐 파일 확인

```powershell
git status
```

여기에 파일 이름이 보이면, 그 파일들이 이번에 바뀐 파일입니다.

### 6. 저장 지점 만들기

```powershell
git add .
git commit -m "수정 내용 짧게 적기"
```

예시는 이렇게 쓰면 됩니다.

```powershell
git commit -m "Update gallery design"
```

영어가 어려우면 이렇게 써도 됩니다.

```powershell
git commit -m "갤러리 디자인 수정"
```

### 7. GitHub에 올리기

```powershell
git push
```

이 명령을 실행하면 Vercel이 자동으로 배포를 시작합니다.

### 8. 공개 사이트 확인

1분에서 2분 정도 기다린 뒤 아래 주소를 새로고침합니다.

```text
https://met-motion-gallery.vercel.app
```

바뀐 내용이 보이면 성공입니다.

## Codex에게 맡길 때

직접 명령어를 치는 것이 어렵다면 Codex에게 이렇게 말하면 됩니다.

```text
이 사이트에서 [원하는 수정] 해주고, 테스트한 다음 GitHub에 올려서 자동 배포 확인까지 해줘.
```

예시:

```text
이 사이트에서 카드 간격을 조금 줄여주고, 테스트한 다음 GitHub에 올려서 자동 배포 확인까지 해줘.
```

Codex가 해야 하는 일은 아래입니다.

```text
파일 수정
-> npm test
-> git add .
-> git commit
-> git push
-> Vercel 배포 완료 확인
-> 공개 사이트 확인
```

## 걱정하지 않아도 되는 것

```text
공개 사이트 주소
계속 https://met-motion-gallery.vercel.app 입니다.

GitHub와 Vercel 연결
이미 연결되어 있습니다.

매번 Vercel에 직접 들어가기
보통 필요 없습니다.

npx vercel --prod
보통 필요 없습니다. git push가 기본 방법입니다.
```

## 자주 생기는 상황

### `nothing to commit`이 나올 때

Git이 볼 때 새로 바뀐 파일이 없다는 뜻입니다.

가능한 이유:

```text
이미 저장 지점을 만들었음
파일을 실제로 저장하지 않았음
수정한 내용이 없음
```

### `npm test`가 실패할 때

공개 사이트에 올리기 전에 고치는 것이 좋습니다.

Codex에게 이렇게 말하면 됩니다.

```text
npm test가 실패했어. 원인 확인하고 고쳐줘.
```

### commit 메시지를 뭘로 쓸지 모르겠을 때

짧게만 쓰면 됩니다.

```powershell
git commit -m "Update site"
git commit -m "Fix layout"
git commit -m "Change text"
git commit -m "디자인 수정"
```

### `localhost:4173`이 안 열릴 때

다른 프로그램이 같은 번호를 쓰고 있을 수 있습니다.

이렇게 다른 번호로 실행합니다.

```powershell
$env:PORT="4174"; npm start
```

그다음 브라우저에서 엽니다.

```text
http://localhost:4174
```

### GitHub에 올렸는데 사이트가 바로 안 바뀔 때

조금 기다립니다. 보통 1분에서 2분 정도 걸립니다.

그래도 안 바뀌면 브라우저 새로고침을 강하게 해봅니다.

```text
Ctrl + F5
```

또는 Vercel에서 배포 상태가 `Ready`인지 확인합니다.

```powershell
npx vercel@latest ls met-motion-gallery
```

가장 위에 있는 배포가 `Ready`이면 완료된 상태입니다.

## 이 프로젝트에서 가장 안전한 작업 방식

직접 하든 Codex에게 맡기든 이 순서를 지키면 됩니다.

```text
1. 먼저 내 컴퓨터에서 수정
2. npm test로 검사
3. commit으로 저장 지점 만들기
4. push로 GitHub에 올리기
5. Vercel 자동 배포 기다리기
6. 공개 사이트 새로고침해서 확인
```

가장 짧게 기억할 문장:

```text
수정 후 npm test, git add, git commit, git push를 하면 공개 사이트가 자동으로 최신화된다.
```
