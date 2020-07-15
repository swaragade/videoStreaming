let peerConnection;
let mediaRecorder;
let recordedBlobs;

const config = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302"]
    }
  ]
};

const socket = io.connect(window.location.origin);
const video = document.querySelector("video#streamed");
const recordedVideo = document.querySelector('video#recorded');
const recordButton = document.querySelector('button#record');

socket.on("offer", (id, description) => {
  peerConnection = new RTCPeerConnection(config);
  peerConnection
    .setRemoteDescription(description)
    .then(() => peerConnection.createAnswer())
    .then(sdp => peerConnection.setLocalDescription(sdp))
    .then(() => {
      socket.emit("answer", id, peerConnection.localDescription);
    });
  peerConnection.ontrack = event => {
    video.srcObject = event.streams[0];
	window.stream = event.streams[0];
	if (event.streams[0] === null || event.streams[0] === undefined){
		recordButton.disabled = true;
	}else{
		recordButton.disabled = false;
	}
  };
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("candidate", id, event.candidate);
    }
  };
});

socket.on("candidate", (id, candidate) => {
  peerConnection
    .addIceCandidate(new RTCIceCandidate(candidate))
    .catch(e => console.error(e));
});

socket.on("connect", () => {
  socket.emit("watcher");
});

socket.on("broadcaster", () => {
  socket.emit("watcher");
});

socket.on("disconnectPeer", () => {
  peerConnection.close();
});

window.onunload = window.onbeforeunload = () => {
  socket.close();
};


// UI transactions

recordButton.addEventListener('click', () => {
  if (recordButton.textContent === 'Start Recording') {
    startRecording();
	recordButton.textContent = 'Stop Recording';
  } else {
    stopRecording();
    recordButton.textContent = 'Start Recording';
    playButton.disabled = false;
    downloadButton.disabled = false;
  }
});

const playButton = document.querySelector('button#play');
playButton.addEventListener('click', () => {
  const superBuffer = new Blob(recordedBlobs, {type: 'video/webm'});
  recordedVideo.src = null;
  recordedVideo.srcObject = null;
  recordedVideo.src = window.URL.createObjectURL(superBuffer);
  recordedVideo.controls = true;
  recordedVideo.play();
});

const downloadButton = document.querySelector('button#download');
downloadButton.addEventListener('click', () => {
  const blob = new Blob(recordedBlobs, {type: 'video/webm'});
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  console.log(url);
  a.download = 'test.webm';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
});

function handleDataAvailable(event) {
  console.log('handleDataAvailable', event);
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
  }
}

function startRecording() {
  recordedBlobs = [];
  let options = {mimeType: 'video/webm;codecs=vp9,opus'};
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    console.error(`${options.mimeType} is not supported`);
    options = {mimeType: 'video/webm;codecs=vp8,opus'};
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.error(`${options.mimeType} is not supported`);
      options = {mimeType: 'video/webm'};
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.error(`${options.mimeType} is not supported`);
        options = {mimeType: ''};
      }
    }
  }

  try {
    mediaRecorder = new MediaRecorder(window.stream, options);
  } catch (e) {
    console.error('Exception while creating MediaRecorder:', e);
    errorMsgElement.innerHTML = `Exception while creating MediaRecorder: ${JSON.stringify(e)}`;
    return;
  }

  console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
  recordButton.textContent = 'Stop Recording';
  playButton.disabled = true;
  downloadButton.disabled = true;
  mediaRecorder.onstop = (event) => {
    console.log('Recorder stopped: ', event);
    console.log('Recorded Blobs: ', recordedBlobs);
  };
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start();
  console.log('MediaRecorder started', mediaRecorder);
}

function stopRecording() {
  mediaRecorder.stop();
}