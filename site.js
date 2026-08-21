(function () {

  /* =========================================================
     MOBILE MENU
     ========================================================= */

  const menuButton = document.querySelector('.menu-button');
  const siteNav = document.querySelector('.site-nav');

  if (menuButton && siteNav) {
    menuButton.addEventListener('click', () => {
      const open = siteNav.classList.toggle('is-open');
      menuButton.setAttribute('aria-expanded', String(open));
    });
  }



  /* =========================================================
     GA4 EVENT HELPER
     ========================================================= */

  function trackEvent(eventName, parameters = {}) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, parameters);
    }
  }


/* =========================================================
   QUFC FACE-OFF — CAMERA CONTROLLER
   ========================================================= */
   
   const faceoffConfirmation =
  document.querySelector(
    '[data-faceoff-confirmation]'
  );

const faceoffConfirmationTitle =
  document.querySelector(
    '[data-faceoff-confirmation-title]'
  );

const faceoffConfirmationCopy =
  document.querySelector(
    '[data-faceoff-confirmation-copy]'
  );

const faceoffConfirmationDoneButton =
  document.querySelector(
    '[data-faceoff-confirmation-done]'
  );
   
const faceoffHeroEyebrow =
  document.querySelector('[data-faceoff-hero-eyebrow]');

const faceoffHeroTitle =
  document.querySelector('[data-faceoff-hero-title]');

const faceoffHeroCopy =
  document.querySelector('[data-faceoff-hero-copy]');

const faceoffLaunchButton =
  document.querySelector('[data-faceoff-launch]');

const faceoffTitle =
  document.querySelector('[data-faceoff-title]');

const faceoffLead =
  document.querySelector('[data-faceoff-lead]');

const faceoffSection =
  document.querySelector('[data-faceoff-section]');

const faceoffCameraFrame =
  document.querySelector('[data-faceoff-camera-frame]');

const faceoffPlaceholder =
  document.querySelector('[data-faceoff-placeholder]');

const faceoffCameraOpenButton =
  document.querySelector('[data-faceoff-camera-open]');

const faceoffVideo =
  document.querySelector('[data-faceoff-video]');

const faceoffPreview =
  document.querySelector('[data-faceoff-preview]');

const faceoffCanvas =
  document.querySelector('[data-faceoff-canvas]');

const faceoffShareCanvas =
  document.querySelector('[data-faceoff-share-canvas]');

const faceoffCaptureButton =
  document.querySelector('[data-faceoff-capture]');

const faceoffRetakeButton =
  document.querySelector('[data-faceoff-retake]');

const faceoffShareButton =
  document.querySelector('[data-faceoff-share]');
  
  const faceoffChallengeAnotherButton =
  document.querySelector(
    '[data-faceoff-challenge-another]'
  );

const faceoffCloseButton =
  document.querySelector('[data-faceoff-close]');

const faceoffCloseTopButton =
  document.querySelector('[data-faceoff-close-top]');

const faceoffStatus =
  document.querySelector('[data-faceoff-status]');

let faceoffStream = null;
let faceoffCameraRequestToken = 0;
let faceoffPhotoBlob = null;


function isIncomingFaceoff() {
  if (!window.location.hash) {
    return false;
  }

  const params =
    new URLSearchParams(
      window.location.hash.slice(1)
    );

  /*
    New Face-Off invitations only need f=1.
    Older seeded Face-Off URLs remain compatible because
    any legacy c= and d= values are simply ignored.
  */
  return params.get('f') === '1';
}


const incomingFaceoff =
  isIncomingFaceoff();

function setFaceoffStatus(message = '') {
  if (faceoffStatus) {
    faceoffStatus.textContent = message;
  }
}


function clearCanvas(canvas) {
  if (!canvas) {
    return;
  }

  const context =
    canvas.getContext('2d');

  if (!context) {
    return;
  }

  context.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );
}


function clearFaceoffPhoto() {
  faceoffPhotoBlob = null;

  if (faceoffPreview) {
    faceoffPreview.removeAttribute('src');
    faceoffPreview.hidden = true;
  }

  clearCanvas(faceoffCanvas);
  clearCanvas(faceoffShareCanvas);
}


function setFaceoffControlsState(state = 'idle') {
  
  if (faceoffChallengeAnotherButton) {
  faceoffChallengeAnotherButton.hidden =
    !(state === 'captured' && incomingFaceoff);
}

  if (faceoffCaptureButton) {
    faceoffCaptureButton.hidden =
      state !== 'live';
  }

  if (faceoffRetakeButton) {
    faceoffRetakeButton.hidden =
      state !== 'captured';
  }

  if (faceoffShareButton) {
    faceoffShareButton.hidden =
      state !== 'captured';
  }
}


function stopFaceoffCamera({ showPlaceholder = true } = {}) {
  faceoffCameraRequestToken++;

  if (faceoffStream) {
    faceoffStream.getTracks().forEach(track => {
      track.stop();
    });

    faceoffStream = null;
  }

  if (faceoffVideo) {
    faceoffVideo.pause();
    faceoffVideo.srcObject = null;
    faceoffVideo.hidden = true;
  }

  if (faceoffCameraOpenButton) {
    faceoffCameraOpenButton.disabled = false;
  }

  if (
    faceoffPlaceholder &&
    showPlaceholder &&
    (!faceoffPreview || faceoffPreview.hidden)
  ) {
    faceoffPlaceholder.hidden = false;
  }
}


function getFaceoffCameraErrorMessage(error) {
  switch (error?.name) {

    case 'NotAllowedError':
      return 'Camera access was not granted. Nothing was captured. You can change your browser permission and try again.';

    case 'NotFoundError':
      return 'QUFC could not find a camera on this device.';

    case 'NotReadableError':
      return 'Your camera could not be started. Another app or browser tab may already be using it.';

    case 'OverconstrainedError':
      return 'Your camera did not like the requested settings. QUFC has been judged by hardware.';

    case 'SecurityError':
    case 'TypeError':
      return 'This browser is not allowing camera access on this page.';

    default:
      return 'QUFC could not open the camera. Your dignity remains temporarily protected.';
  }
}

function getFaceoffShareUrl() {
  const baseUrl =
    `${window.location.origin}${window.location.pathname}`;

  return `${baseUrl}#f=1`;
}


function openFaceoffPanel() {
   if (!faceoffSection) {
    return;
  }

  if (faceoffConfirmation) {
    faceoffConfirmation.hidden = true;
  }

  if (faceoffCameraOpenButton) {
    faceoffCameraOpenButton.hidden = false;
  }

  if (faceoffCameraFrame) {
    faceoffCameraFrame.hidden = false;
  }

  clearFaceoffPhoto();
  stopFaceoffCamera();
  setFaceoffControlsState('idle');
  setFaceoffStatus('');

  if (faceoffPlaceholder) {
    faceoffPlaceholder.hidden = false;
  }

  faceoffSection.hidden = false;

  faceoffSection.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });

  trackEvent('challenge_faceoff_open');
}


function closeFaceoffPanel() {
  stopFaceoffCamera();
  clearFaceoffPhoto();
  setFaceoffControlsState('idle');
  setFaceoffStatus('');

  if (faceoffPlaceholder) {
    faceoffPlaceholder.hidden = false;
  }

  if (faceoffSection) {
    faceoffSection.hidden = true;
  }

  if (faceoffLaunchButton) {
    faceoffLaunchButton.focus();
  }
}


async function openFaceoffCamera() {

  if (
    !faceoffVideo ||
    !faceoffPlaceholder ||
    !faceoffCameraOpenButton
  ) {
    return;
  }

  if (
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    setFaceoffStatus(
      'This browser cannot open a camera here. Your dignity has been spared by technology.'
    );
    return;
  }

  clearFaceoffPhoto();
  stopFaceoffCamera();
  setFaceoffControlsState('idle');

  const requestToken =
    ++faceoffCameraRequestToken;

  faceoffCameraOpenButton.disabled = true;

  setFaceoffStatus(
    'Requesting camera permission…'
  );

  try {

    const stream =
      await navigator.mediaDevices.getUserMedia({
        audio: false,

        video: {
          facingMode: {
            ideal: 'user'
          },

          width: {
            ideal: 1080
          },

          height: {
            ideal: 1350
          }
        }
      });

    if (
      requestToken !== faceoffCameraRequestToken ||
      !faceoffSection ||
      faceoffSection.hidden
    ) {
      stream.getTracks().forEach(track => {
        track.stop();
      });

      return;
    }

    faceoffStream = stream;

    faceoffVideo.srcObject =
      stream;

    await faceoffVideo.play();

    faceoffPlaceholder.hidden =
      true;

    faceoffVideo.hidden =
      false;

    setFaceoffControlsState('live');

    setFaceoffStatus(
      'Camera ready. Make your worst face, then snap your dignity.'
    );

    trackEvent('challenge_camera_open');

  } catch (error) {

    stopFaceoffCamera();

    setFaceoffStatus(
      getFaceoffCameraErrorMessage(error)
    );

  } finally {

    if (faceoffCameraOpenButton) {
      faceoffCameraOpenButton.disabled = false;
    }

  }
}


async function captureFaceoffPhoto() {
  if (
    !faceoffVideo ||
    !faceoffCanvas ||
    !faceoffPreview
  ) {
    return;
  }

  if (
    !faceoffVideo.videoWidth ||
    !faceoffVideo.videoHeight
  ) {
    setFaceoffStatus(
      'QUFC could not read the live camera image yet. Try opening the camera again.'
    );
    return;
  }

  setFaceoffStatus(
    'Capturing your facial catastrophe…'
  );

  const sourceWidth =
    faceoffVideo.videoWidth;

  const sourceHeight =
    faceoffVideo.videoHeight;

  const targetWidth =
    1080;

  const targetHeight =
    1350;

  const targetAspect =
    targetWidth / targetHeight;

  let cropWidth =
    sourceWidth;

  let cropHeight =
    sourceHeight;

  let cropX = 0;
  let cropY = 0;

  if (
    sourceWidth / sourceHeight > targetAspect
  ) {
    cropWidth =
      sourceHeight * targetAspect;

    cropX =
      (sourceWidth - cropWidth) / 2;

  } else if (
    sourceWidth / sourceHeight < targetAspect
  ) {
    cropHeight =
      sourceWidth / targetAspect;

    cropY =
      (sourceHeight - cropHeight) / 2;
  }

  faceoffCanvas.width =
    targetWidth;

  faceoffCanvas.height =
    targetHeight;

  const context =
    faceoffCanvas.getContext('2d');

  if (!context) {
    setFaceoffStatus(
      'QUFC could not prepare the photo canvas.'
    );
    return;
  }

  context.clearRect(
    0,
    0,
    targetWidth,
    targetHeight
  );

  /*
    Mirror the captured photo so it matches the live preview.
  */
  context.save();
  context.translate(targetWidth, 0);
  context.scale(-1, 1);

  context.drawImage(
    faceoffVideo,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    targetWidth,
    targetHeight
  );

  context.restore();

  const blob =
    await new Promise(resolve => {
      faceoffCanvas.toBlob(
        resolve,
        'image/jpeg',
        0.92
      );
    });

  if (!blob) {
    setFaceoffStatus(
      'QUFC captured the moment emotionally, but not technically. Try again.'
    );
    return;
  }

  faceoffPhotoBlob =
    blob;

  faceoffPreview.src =
    faceoffCanvas.toDataURL(
      'image/jpeg',
      0.92
    );

  faceoffPreview.hidden =
    false;

  if (faceoffPlaceholder) {
    faceoffPlaceholder.hidden = true;
  }

  stopFaceoffCamera({
    showPlaceholder: false
  });

  setFaceoffControlsState('captured');

  setFaceoffStatus(
    'Dignity captured locally. QUFC has not uploaded or stored this photo.'
  );

  trackEvent('challenge_photo_capture');
}


async function retakeFaceoffPhoto() {
  trackEvent('challenge_photo_retake');

  clearFaceoffPhoto();
  await openFaceoffCamera();
}




function drawRoundedRectPath(
  context,
  x,
  y,
  width,
  height,
  radius
) {
  const r =
    Math.min(
      radius,
      width / 2,
      height / 2
    );

  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + r
  );
  context.lineTo(
    x + width,
    y + height - r
  );
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - r,
    y + height
  );
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - r
  );
  context.lineTo(x, y + r);
  context.quadraticCurveTo(
    x,
    y,
    x + r,
    y
  );
  context.closePath();
}


function fillRoundedRect(
  context,
  x,
  y,
  width,
  height,
  radius,
  fillStyle,
  strokeStyle,
  lineWidth = 0
) {
  drawRoundedRectPath(
    context,
    x,
    y,
    width,
    height,
    radius
  );

  if (fillStyle) {
    context.fillStyle = fillStyle;
    context.fill();
  }

  if (strokeStyle && lineWidth > 0) {
    context.lineWidth = lineWidth;
    context.strokeStyle = strokeStyle;
    context.stroke();
  }
}



async function buildFaceoffShareFile() {
  if (
    !faceoffShareCanvas ||
    !faceoffCanvas ||
    !faceoffPhotoBlob
  ) {
    return null;
  }

  const styles =
    getComputedStyle(document.documentElement);

  const ink =
    styles.getPropertyValue('--ink').trim() || '#111111';

  const cyan =
    styles.getPropertyValue('--cyan').trim() || '#19dfe7';

  const gold =
    styles.getPropertyValue('--gold').trim() || '#f4cf4f';

  const pink =
    styles.getPropertyValue('--pink').trim() || '#ff76b8';

  const paper =
    '#fffdf7';

  const cardWidth =
    1080;

  const cardHeight =
    1600;

  faceoffShareCanvas.width =
    cardWidth;

  faceoffShareCanvas.height =
    cardHeight;

  const context =
    faceoffShareCanvas.getContext('2d');

  if (!context) {
    return null;
  }

  context.clearRect(
    0,
    0,
    cardWidth,
    cardHeight
  );

  context.fillStyle =
    cyan;

  context.fillRect(
    0,
    0,
    cardWidth,
    cardHeight
  );

  fillRoundedRect(
    context,
    26,
    26,
    cardWidth - 52,
    cardHeight - 52,
    34,
    gold,
    ink,
    10
  );

  fillRoundedRect(
    context,
    76,
    72,
    cardWidth - 152,
    118,
    28,
    paper,
    ink,
    6
  );

  context.fillStyle =
    ink;

  context.textAlign =
    'center';

  context.font =
    '900 58px Arial';

  context.fillText(
    'QUFC FACE-OFF 🤢',
    cardWidth / 2,
    148
  );

  fillRoundedRect(
    context,
    120,
    232,
    840,
    1050,
    28,
    paper,
    ink,
    8
  );

  context.drawImage(
    faceoffCanvas,
    138,
    250,
    804,
    1014
  );

  fillRoundedRect(
    context,
    84,
    1316,
    912,
    220,
    28,
    paper,
    ink,
    6
  );

  context.textAlign =
    'left';

  context.fillStyle =
    ink;

  context.font =
    '900 22px Arial';

  context.fillText(
    'UGLY FACE CHALLENGE',
    128,
    1372
  );

  fillRoundedRect(
    context,
    790,
    1344,
    168,
    60,
    30,
    pink,
    ink,
    5
  );

  context.textAlign =
    'center';

  context.font =
    '900 27px Arial';

  context.fillText(
    'YOUR TURN',
    874,
    1384
  );

  context.textAlign =
    'left';

  context.font =
    '900 52px Arial';

  context.fillText(
    'CAN YOU DO WORSE?',
    128,
    1452
  );

  context.font =
    '700 24px Arial';

  context.fillText(
    'Make your worst face. Capture it. Send it back.',
    128,
    1497
  );

  context.font =
    '900 24px Arial';

  context.fillText(
    'QUFC.IT.COM',
    128,
    1530
  );

  const shareBlob =
    await new Promise(resolve => {
      faceoffShareCanvas.toBlob(
        resolve,
        'image/jpeg',
        0.92
      );
    });

  if (!shareBlob) {
    return null;
  }

  return new File(
    [shareBlob],
    'qufc-faceoff-your-turn.jpg',
    { type: 'image/jpeg' }
  );
}


function downloadFaceoffFile(file) {
  const objectUrl =
    URL.createObjectURL(file);

  const link =
    document.createElement('a');

  link.href =
    objectUrl;

  link.download =
    file.name;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}

function showFaceoffConfirmation(
  mode = 'new'
) {

  /*
    Once sharing succeeds, the camera/photo stage is finished.
  */
  if (faceoffCameraFrame) {
    faceoffCameraFrame.hidden = true;
  }

  if (faceoffCameraOpenButton) {
    faceoffCameraOpenButton.hidden = true;
  }

  if (faceoffPlaceholder) {
    faceoffPlaceholder.hidden = true;
  }

  if (faceoffVideo) {
    faceoffVideo.hidden = true;
  }

  if (faceoffPreview) {
    faceoffPreview.hidden = true;
  }


  /*
    Hide the normal Face-Off action buttons.
  */
  if (faceoffCaptureButton) {
    faceoffCaptureButton.hidden = true;
  }

  if (faceoffRetakeButton) {
    faceoffRetakeButton.hidden = true;
  }

  if (faceoffShareButton) {
    faceoffShareButton.hidden = true;
  }

  if (faceoffChallengeAnotherButton) {
    faceoffChallengeAnotherButton.hidden = true;
  }


  /*
    Give return-fire shares slightly different confirmation
    copy from brand-new Face-Offs.
  */
  if (mode === 'return') {

    if (faceoffConfirmationTitle) {
      faceoffConfirmationTitle.textContent =
        'Return Fire launched! ↩️🤢';
    }

    if (faceoffConfirmationCopy) {
      faceoffConfirmationCopy.textContent =
        'Your response has been handed off. If you chose the original conversation, your challenger can now see your counterattack.';
    }

  } else {

    if (faceoffConfirmationTitle) {
      faceoffConfirmationTitle.textContent =
        'Face-Off launched! 🤢';
    }

    if (faceoffConfirmationCopy) {
      faceoffConfirmationCopy.textContent =
        'Your Face-Off has been handed off. Now we wait to see if somebody can do worse.';
    }

  }


  if (faceoffConfirmation) {
    faceoffConfirmation.hidden = false;
  }

  setFaceoffStatus('');
}

async function shareFaceoffChallenge(
  mode = incomingFaceoff ? 'return' : 'new') {
  if (!faceoffPhotoBlob) {
    setFaceoffStatus(
      'Snap your dignity first.'
    );
    return;
  }

  if (faceoffShareButton) {
    faceoffShareButton.disabled = true;
  }

  if (faceoffChallengeAnotherButton) {
    faceoffChallengeAnotherButton.disabled = true;
  }

  setFaceoffStatus(
    'Building your QUFC Face-Off card…'
  );

  try {
    const shareFile =
      await buildFaceoffShareFile();

    if (!shareFile) {
      throw new Error(
        'Face-Off card build failed.'
      );
    }

    const shareUrl =
      getFaceoffShareUrl();

const returningFire =
  mode === 'return';

const shareText = returningFire
  ? [
      '🤢 QUFC FACE-OFF — RETURN FIRE',
      '',
      'You challenged me.',
      'This is my response. Think you can do worse?',
      '',
      'Your turn again:',
      shareUrl
    ].join('\n')
  : [
      '🤢 QUFC FACE-OFF',
      '',
      'I made my ugliest face. Think you can do worse?',
      '',
      'Make your worst face and send it back:',
      shareUrl
    ].join('\n');

    const shareData = {
      title: 'QUFC Face-Off — Your Turn',
      text: shareText,
      files: [shareFile]
    };

    if (
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [shareFile] })
    ) {
      await navigator.share(shareData);

trackEvent('challenge_faceoff_share', {
  share_mode: returningFire
    ? 'return'
    : 'new'
});

showFaceoffConfirmation(
  returningFire
    ? 'return'
    : 'new'
);

return;
    }

    downloadFaceoffFile(shareFile);

    let copied =
      false;

    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      try {
        await navigator.clipboard.writeText(
          shareText
        );

        copied = true;
      } catch (error) {
        copied = false;
      }
    }

    if (copied) {
      setFaceoffStatus(
        'This browser cannot directly share image files. QUFC downloaded your Face-Off card and copied the Face-Off invitation to your clipboard.'
      );
    } else {
      setFaceoffStatus(
        'This browser cannot directly share image files. QUFC downloaded your Face-Off card. Attach it manually and send the Face-Off link.'
      );
    }

    trackEvent('challenge_faceoff_share', {
  share_mode: returningFire
    ? 'return'
    : 'new'
});

  } catch (error) {
    if (error?.name === 'AbortError') {
      setFaceoffStatus(
        'Share cancelled. Your Face-Off card is still ready.'
      );
    } else {
      setFaceoffStatus(
        'QUFC could not prepare the Face-Off card. Your dignity remains local.'
      );
    }

  } finally {
    if (faceoffShareButton) {
      faceoffShareButton.disabled = false;
    }

    if (faceoffChallengeAnotherButton) {
      faceoffChallengeAnotherButton.disabled = false;
    }
  }
}


function initializeIncomingFaceoff() {
 if (!incomingFaceoff) {
    return;
  }

  if (faceoffHeroEyebrow) {
    faceoffHeroEyebrow.textContent =
      'INCOMING FACIAL EMERGENCY';
  }

  if (faceoffHeroTitle) {
    faceoffHeroTitle.textContent =
      "YOU HAVE BEEN FACE-OFF'D. 🤢";
  }

  if (faceoffHeroCopy) {
    faceoffHeroCopy.textContent =
      'Someone thinks their ugly face can beat yours. Make any ugly face you want, capture the evidence, and send your counterattack back.';
  }

  if (faceoffLaunchButton) {
    faceoffLaunchButton.textContent =
      '📸 Accept the Face-Off';
  }

  if (faceoffTitle) {
    faceoffTitle.textContent =
      'Return Fire.';
  }

  if (faceoffLead) {
    faceoffLead.textContent =
      'Someone challenged your face. There are no instructions to copy — make whatever ugly expression you think can beat theirs, capture the evidence, and send your response back.';
  }

  trackEvent(
    'challenge_faceoff_received'
  );
}

if (
  faceoffLaunchButton &&
  faceoffSection &&
  faceoffCameraOpenButton &&
  faceoffVideo &&
  faceoffPreview &&
  faceoffCanvas &&
  faceoffShareCanvas &&
  faceoffCaptureButton &&
  faceoffRetakeButton &&
  faceoffShareButton &&
  faceoffCloseButton
) {

  setFaceoffControlsState('idle');
  
  
    /*
    Change the sharing button depending on whether this
    person started the Face-Off or is responding to one.
  */
  
  if (incomingFaceoff) {
  faceoffShareButton.textContent =
    '↩️ Send It Back';
} else {
  faceoffShareButton.textContent =
    '💀 Challenge Someone';
}

  faceoffLaunchButton.addEventListener(
    'click',
    openFaceoffPanel
  );
  

  faceoffCameraOpenButton.addEventListener(
    'click',
    openFaceoffCamera
  );

  faceoffCaptureButton.addEventListener(
    'click',
    captureFaceoffPhoto
  );

  faceoffRetakeButton.addEventListener(
    'click',
    retakeFaceoffPhoto
  );

faceoffShareButton.addEventListener(
  'click',
  () => {
    shareFaceoffChallenge(
      incomingFaceoff
        ? 'return'
        : 'new'
    );
  }
);

if (faceoffChallengeAnotherButton) {
  faceoffChallengeAnotherButton.addEventListener(
    'click',
    () => {
      shareFaceoffChallenge('new');
    }
  );
}



if (faceoffConfirmationDoneButton) {
  faceoffConfirmationDoneButton.addEventListener(
    'click',
    closeFaceoffPanel
  );
}

faceoffCloseButton.addEventListener(
  'click',
  closeFaceoffPanel
);

  if (faceoffCloseTopButton) {
    faceoffCloseTopButton.addEventListener(
      'click',
      closeFaceoffPanel
    );
  }

  window.addEventListener('pagehide', () => {
    stopFaceoffCamera({
      showPlaceholder: false
    });
  });

  document.addEventListener(
    'visibilitychange',
    () => {

      if (
        document.hidden &&
        faceoffStream
      ) {
        stopFaceoffCamera();

        setFaceoffStatus(
          'Camera stopped when you left the page. Tap Open Camera to continue.'
        );
      }

    }
  );
  initializeIncomingFaceoff();
}


 /* =========================================================
   GUESTBOOK WINDOW
   ========================================================= */

const guestbookWindow = document.getElementById('guestbook-window');
const openGuestbook = document.getElementById('open-guestbook');
const closeGuestbook = document.getElementById('close-guestbook');
const guestbookTitlebar = document.getElementById('guestbook-titlebar');

if (
  guestbookWindow &&
  openGuestbook &&
  closeGuestbook &&
  guestbookTitlebar
) {
  openGuestbook.addEventListener('click', () => {
    guestbookWindow.hidden = false;
    closeGuestbook.focus();
  });

  closeGuestbook.addEventListener('click', () => {
    guestbookWindow.hidden = true;
    openGuestbook.focus();
  });

  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let dragInitialized = false;

  guestbookTitlebar.addEventListener('mousedown', (event) => {
    if (event.target === closeGuestbook) return;

    const rect = guestbookWindow.getBoundingClientRect();

    if (!dragInitialized) {
      guestbookWindow.style.left = rect.left + 'px';
      guestbookWindow.style.top = rect.top + 'px';
      guestbookWindow.style.transform = 'none';
      dragInitialized = true;
    }

    isDragging = true;
    dragOffsetX = event.clientX - guestbookWindow.offsetLeft;
    dragOffsetY = event.clientY - guestbookWindow.offsetTop;

    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (event) => {
    if (!isDragging) return;

    let newLeft = event.clientX - dragOffsetX;
    let newTop = event.clientY - dragOffsetY;

    const maxLeft = window.innerWidth - guestbookWindow.offsetWidth;
    const maxTop = window.innerHeight - guestbookWindow.offsetHeight;

    if (newLeft < 0) newLeft = 0;
    if (newTop < 0) newTop = 0;
    if (newLeft > maxLeft) newLeft = maxLeft;
    if (newTop > maxTop) newTop = maxTop;

    guestbookWindow.style.left = newLeft + 'px';
    guestbookWindow.style.top = newTop + 'px';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.userSelect = '';
  });
  
  document.addEventListener('keydown', (event) => {
  if (
    event.key === 'Escape' &&
    !guestbookWindow.hidden
  ) {
    isDragging = false;
    document.body.style.userSelect = '';

    guestbookWindow.hidden = true;
    openGuestbook.focus();
  }
});
}

/* =========================================================
   HALL OF FACES — IMAGE VIEWER
   ========================================================= */

const hallPhotoButtons =
  document.querySelectorAll('[data-hall-photo]');

const hallLightbox =
  document.querySelector('[data-hall-lightbox]');

const hallLightboxImage =
  document.querySelector('[data-hall-lightbox-image]');

const hallLightboxTitle =
  document.querySelector('[data-hall-lightbox-title]');

const hallLightboxCloseButtons =
  document.querySelectorAll(
    '[data-hall-lightbox-close]'
  );

let hallLastFocusedElement = null;


function openHallLightbox(button) {

  if (
    !hallLightbox ||
    !hallLightboxImage ||
    !hallLightboxTitle
  ) {
    return;
  }

  const image =
    button.querySelector('img');

  if (!image) {
    return;
  }

  const faceName =
    button.dataset.faceName || 'Archived face';

  hallLastFocusedElement = button;

  hallLightboxImage.src =
    image.currentSrc || image.src;

  hallLightboxImage.alt =
    image.alt;

  hallLightboxTitle.textContent =
    `${faceName} — Archive Close-Up`;

  hallLightbox.hidden = false;

  document.body.style.overflow = 'hidden';

  const closeButton =
    hallLightbox.querySelector(
      '.hall-lightbox-close'
    );

  if (closeButton) {
    closeButton.focus();
  }

}


function closeHallLightbox() {

  if (!hallLightbox) {
    return;
  }

  hallLightbox.hidden = true;

  document.body.style.overflow = '';

  if (hallLightboxImage) {
    hallLightboxImage.src = '';
    hallLightboxImage.alt = '';
  }

  if (hallLastFocusedElement) {
    hallLastFocusedElement.focus();
  }

}


hallPhotoButtons.forEach((button) => {

  button.addEventListener(
    'click',
    () => {
      openHallLightbox(button);
    }
  );

});


hallLightboxCloseButtons.forEach((button) => {

  button.addEventListener(
    'click',
    closeHallLightbox
  );

});


document.addEventListener(
  'keydown',
  (event) => {

    if (
      event.key === 'Escape' &&
      hallLightbox &&
      !hallLightbox.hidden
    ) {
      closeHallLightbox();
    }

  }
);
 
 
 /* =========================================================
   FACE-OFF CTA TRACKING
   ========================================================= */

const faceoffCtaLinks =
  document.querySelectorAll('[data-faceoff-cta]');

faceoffCtaLinks.forEach((link) => {

  link.addEventListener(
    'click',
    () => {

      const source =
        link.dataset.faceoffCta || 'unknown';

      trackEvent('faceoff_cta_click', {
        cta_source: source
      });

    }
  );

});
  /* =========================================================
     PRACTICE BALLOT
     ========================================================= */

  const ballot =
    document.querySelector('[data-ballot]');

  if (ballot) {

    const maxVotes = 1;

const counts = {};

const rows = [
  ...ballot.querySelectorAll('[data-candidate]')
];

const remaining =
  ballot.querySelector('[data-votes-left]');

const summary =
  ballot.querySelector('[data-vote-summary]');

rows.forEach(row => {
  counts[row.dataset.candidate] = 0;
});

const total = () =>
  Object.values(counts)
    .reduce((a, b) => a + b, 0);

const render = () => {

  rows.forEach(row => {

    row.querySelector('[data-count]').textContent =
      counts[row.dataset.candidate];

  });

  remaining.textContent =
    maxVotes - total();

  const selected =
    Object.entries(counts)

      .filter(([, n]) => n)

      .map(([name]) => name);

  summary.textContent =
    selected.length
      ? selected.join(' · ')
      : 'No practice vote selected yet.';
};


    ballot.addEventListener('click', e => {

      const btn =
        e.target.closest('button[data-action]');

      if (!btn) {
        return;
      }


      const row =
        btn.closest('[data-candidate]');

      const name =
        row.dataset.candidate;


      if (
        btn.dataset.action === 'add' &&
        total() < maxVotes
      ) {
        counts[name]++;
      }


      if (
        btn.dataset.action === 'remove' &&
        counts[name] > 0
      ) {
        counts[name]--;
      }


      render();
    });


    render();
  }

})();


