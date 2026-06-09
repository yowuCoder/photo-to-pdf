import { jsPDF } from 'jspdf';

// State Management
let images = [];
let pdfBlob = null;
let pdfFileName = 'My_Converted_Photos';

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploadTrigger = document.querySelector('.btn-upload-trigger');
const cameraTrigger = document.getElementById('camera-btn');
const cameraInput = document.getElementById('camera-input');
const previewSection = document.getElementById('preview-section');
const previewGrid = document.getElementById('preview-grid');
const photoCount = document.getElementById('photo-count');
const clearAllBtn = document.getElementById('clear-all-btn');
const settingsSection = document.getElementById('settings-section');
const generateBtn = document.getElementById('generate-btn');
const installBtn = document.getElementById('install-btn');

const progressModal = document.getElementById('progress-modal');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const progressTitle = document.getElementById('progress-title');
const progressDesc = document.getElementById('progress-desc');

const successModal = document.getElementById('success-modal');
const successMeta = document.getElementById('success-meta');
const downloadPdfBtn = document.getElementById('download-pdf-btn');
const sharePdfBtn = document.getElementById('share-pdf-btn');
const closeSuccessBtn = document.getElementById('close-success-btn');

// PWA Install Prompt
let deferredPrompt = null;

// ==========================================
// 1. Service Worker & PWA Setup
// ==========================================
window.addEventListener('load', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('ServiceWorker registered successfully with scope: ', registration.scope);
      })
      .catch((error) => {
        console.log('ServiceWorker registration failed: ', error);
      });
  }
});

// PWA Installation Trigger
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  // Update UI notify the user they can install the PWA
  installBtn.classList.remove('hidden');
});

installBtn.addEventListener('click', async () => {
  if (deferredPrompt) {
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again
    deferredPrompt = null;
    // Hide our install button
    installBtn.classList.add('hidden');
  }
});

window.addEventListener('appinstalled', (evt) => {
  console.log('Application installed successfully!');
  showToast('應用程式安裝成功！', 'success');
  installBtn.classList.add('hidden');
});

// ==========================================
// 2. Drag and Drop & File Processing
// ==========================================

// Trigger file dialog
uploadTrigger.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  fileInput.click();
});

dropZone.addEventListener('click', (e) => {
  // Only trigger if clicking directly or on the icon/text, not the button
  if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
    fileInput.click();
  }
});

// Drag events
['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  }, false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  }, false);
});

// Handle dropped files
dropZone.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  const files = dt.files;
  if (files.length > 0) {
    processFiles(files);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    processFiles(e.target.files);
    e.target.value = ''; // Reset input to allow re-uploading same file
  }
});

// Process files and generate local object URLs for preview
function processFiles(fileList) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  let addedCount = 0;

  Array.from(fileList).forEach(file => {
    if (allowedTypes.includes(file.type)) {
      const id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const src = URL.createObjectURL(file);
      images.push({
        id: id,
        file: file,
        name: file.name,
        src: src,
        rotation: 0
      });
      addedCount++;
    } else {
      showToast(`不支援的格式: ${file.name}`, 'warning');
    }
  });

  if (addedCount > 0) {
    showToast(`成功匯入 ${addedCount} 張照片`, 'success');
    updateUI();
  }
}

// ==========================================
// 3. UI Rendering & Interactions
// ==========================================

function updateUI() {
  const count = images.length;
  photoCount.textContent = count;

  if (count > 0) {
    previewSection.classList.remove('hidden');
    settingsSection.classList.remove('hidden');
    renderPreviewGrid();
  } else {
    previewSection.classList.add('hidden');
    settingsSection.classList.add('hidden');
    previewGrid.innerHTML = '';
  }
}

function renderPreviewGrid() {
  previewGrid.innerHTML = '';

  images.forEach((imgObj, index) => {
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.draggable = true;
    item.dataset.id = imgObj.id;
    item.dataset.index = index;

    // Page number badge
    const badge = document.createElement('div');
    badge.className = 'page-index';
    badge.textContent = index + 1;
    item.appendChild(badge);

    // Image thumbnail
    const img = document.createElement('img');
    img.className = 'preview-thumbnail';
    img.src = imgObj.src;
    img.alt = imgObj.name;
    img.style.transform = `rotate(${imgObj.rotation}deg)`;
    item.appendChild(img);

    // Actions panel
    const actions = document.createElement('div');
    actions.className = 'item-actions';

    // Rotate button
    const rotateBtn = document.createElement('button');
    rotateBtn.className = 'btn-action';
    rotateBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i>';
    rotateBtn.title = '旋轉照片';
    rotateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      rotateImage(imgObj.id);
    });
    actions.appendChild(rotateBtn);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-action btn-delete';
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    deleteBtn.title = '刪除照片';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteImage(imgObj.id);
    });
    actions.appendChild(deleteBtn);

    item.appendChild(actions);

    // Drag and Drop event listeners
    setupDragAndDropEvents(item);

    previewGrid.appendChild(item);
  });
}

// Rotate image 90 degrees clockwise
function rotateImage(id) {
  const index = images.findIndex(item => item.id === id);
  if (index !== -1) {
    images[index].rotation = (images[index].rotation + 90) % 360;
    renderPreviewGrid();
  }
}

// Delete image from selection
function deleteImage(id) {
  const index = images.findIndex(item => item.id === id);
  if (index !== -1) {
    URL.revokeObjectURL(images[index].src);
    images.splice(index, 1);
    updateUI();
  }
}

// Clear all selected images
clearAllBtn.addEventListener('click', () => {
  images.forEach(img => URL.revokeObjectURL(img.src));
  images = [];
  updateUI();
  showToast('已清除所有選取照片', 'success');
});

// ==========================================
// 4. Drag & Drop Reordering (HTML5 API)
// ==========================================
let draggedItemIndex = null;

function setupDragAndDropEvents(element) {
  element.addEventListener('dragstart', (e) => {
    draggedItemIndex = parseInt(element.dataset.index);
    element.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  element.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const target = e.target.closest('.preview-item');
    if (target && target !== element) {
      const targetIndex = parseInt(target.dataset.index);
      // Optional: Add visual feedback for swapping
    }
  });

  element.addEventListener('dragend', () => {
    element.classList.remove('dragging');
    draggedItemIndex = null;
  });

  element.addEventListener('drop', (e) => {
    e.preventDefault();
    const target = e.target.closest('.preview-item');
    if (target && draggedItemIndex !== null) {
      const targetIndex = parseInt(target.dataset.index);
      
      if (draggedItemIndex !== targetIndex) {
        // Swap or move item in array
        const draggedItem = images[draggedItemIndex];
        images.splice(draggedItemIndex, 1); // remove
        images.splice(targetIndex, 0, draggedItem); // insert
        
        updateUI();
      }
    }
  });
  
  // Mobile touch support helper for drag and drop (simple version)
  // To keep code concise and performant, we rely on standard HTML5 Drag & Drop
  // which works on modern mobile devices (e.g., iOS 11+, Android Chrome).
}

// ==========================================
// 5. Native Camera Access (via HTML5 Capture)
// ==========================================

cameraTrigger.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  cameraInput.click();
});

cameraInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    processFiles(e.target.files);
    e.target.value = ''; // Reset input to allow recapturing
  }
});

// ==========================================
// 6. Image Rotation & Compression Logic (Canvas)
// ==========================================

// Load image source into Image object helper
const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('圖片載入失敗: ' + e));
    img.src = src;
  });
};

// Rotate and compress the image using canvas, returning a DataURL
async function processImage(imgObj, quality) {
  const img = await loadImage(imgObj.src);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  const rotation = imgObj.rotation;
  
  // Adjust canvas width and height depending on rotation
  if (rotation === 90 || rotation === 270) {
    canvas.width = img.height;
    canvas.height = img.width;
  } else {
    canvas.width = img.width;
    canvas.height = img.height;
  }
  
  // Clear and rotate
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  
  // Export to jpeg with compression quality
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return {
    dataUrl: dataUrl,
    width: canvas.width,
    height: canvas.height
  };
}

// ==========================================
// 7. PDF Generation Core
// ==========================================

generateBtn.addEventListener('click', generatePDF);

async function generatePDF() {
  if (images.length === 0) {
    showToast('請先選取或拍攝照片！', 'warning');
    return;
  }
  
  // Retrieve settings
  const filenameInput = document.getElementById('pdf-filename').value.trim();
  pdfFileName = filenameInput !== '' ? filenameInput : 'My_Converted_Photos';
  const selectedPageSize = document.getElementById('page-size').value;
  const selectedOrientation = document.getElementById('page-orientation').value;
  const selectedMargin = parseInt(document.getElementById('page-margin').value);
  const selectedQuality = parseFloat(document.getElementById('image-quality').value);
  
  // Show progress modal
  progressModal.classList.remove('hidden');
  progressBar.style.width = '0%';
  progressText.textContent = '0%';
  progressTitle.textContent = '正在準備轉檔...';
  progressDesc.textContent = '正在載入照片資源';
  
  try {
    let pdf = null;
    const total = images.length;
    
    // Process page-by-page using setTimeout to prevent UI freezing
    for (let i = 0; i < total; i++) {
      // Small timeout to let UI redraw the progress bar
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const percent = Math.round(((i) / total) * 100);
      progressBar.style.width = `${percent}%`;
      progressText.textContent = `${percent}%`;
      progressTitle.textContent = `正在處理第 ${i + 1} 頁 (共 ${total} 頁)`;
      progressDesc.textContent = `壓縮並轉化: ${images[i].name}`;
      
      // Process image (applies user's rotation and quality compression)
      const processed = await processImage(images[i], selectedQuality);
      
      // Dimensions setup (default jsPDF units is 'mm', 72 pt = 1 inch = 25.4 mm)
      // Conversion: 1 px = 0.264583 mm
      const imgWidthMm = processed.width * 0.264583;
      const imgHeightMm = processed.height * 0.264583;
      
      // Page orientation & Size calculations
      let pOrientation = selectedOrientation;
      if (selectedOrientation === 'auto') {
        pOrientation = (processed.width >= processed.height) ? 'landscape' : 'portrait';
      }
      
      let pSize = selectedPageSize;
      let pSizeWidth = 210; // Default A4 width
      let pSizeHeight = 297; // Default A4 height
      
      if (selectedPageSize === 'a4') {
        pSizeWidth = (pOrientation === 'portrait') ? 210 : 297;
        pSizeHeight = (pOrientation === 'portrait') ? 297 : 210;
      } else if (selectedPageSize === 'letter') {
        pSizeWidth = (pOrientation === 'portrait') ? 215.9 : 279.4;
        pSizeHeight = (pOrientation === 'portrait') ? 279.4 : 215.9;
      } else if (selectedPageSize === 'auto') {
        // Margin doesn't make much sense in Auto Page size, but let's apply it if present
        pSizeWidth = imgWidthMm + (selectedMargin * 2);
        pSizeHeight = imgHeightMm + (selectedMargin * 2);
        pSize = [pSizeWidth, pSizeHeight];
      }
      
      // Initialize jsPDF instance on the first page
      if (i === 0) {
        pdf = new jsPDF({
          orientation: pOrientation,
          unit: 'mm',
          format: pSize
        });
      } else {
        pdf.addPage(pSize, pOrientation);
      }
      
      // Calculate aspect ratio fit (Contain) within printable boundary
      const printableWidth = pSizeWidth - (selectedMargin * 2);
      const printableHeight = pSizeHeight - (selectedMargin * 2);
      
      let finalImgWidth = printableWidth;
      let finalImgHeight = (imgHeightMm / imgWidthMm) * finalImgWidth;
      
      if (finalImgHeight > printableHeight) {
        finalImgHeight = printableHeight;
        finalImgWidth = (imgWidthMm / imgHeightMm) * finalImgHeight;
      }
      
      // Centered position
      const xOffset = selectedMargin + (printableWidth - finalImgWidth) / 2;
      const yOffset = selectedMargin + (printableHeight - finalImgHeight) / 2;
      
      // Add image to PDF
      pdf.addImage(processed.dataUrl, 'JPEG', xOffset, yOffset, finalImgWidth, finalImgHeight);
    }
    
    // Complete generation progress
    progressBar.style.width = '100%';
    progressText.textContent = '100%';
    progressTitle.textContent = '完成封裝 PDF...';
    progressDesc.textContent = '正在打包檔案以供下載。';
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Get output blob
    pdfBlob = pdf.output('blob');
    const sizeInMB = (pdfBlob.size / (1024 * 1024)).toFixed(2);
    
    // Update and show success modal
    successMeta.textContent = `檔案大小: ${sizeInMB} MB | 頁數: ${total} 頁`;
    
    progressModal.classList.add('hidden');
    successModal.classList.remove('hidden');
    
  } catch (err) {
    console.error('PDF 生成失敗:', err);
    progressModal.classList.add('hidden');
    showToast('生成 PDF 失敗，請重試或更換照片。', 'error');
  }
}

// Download Trigger
downloadPdfBtn.addEventListener('click', () => {
  if (!pdfBlob) return;
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(pdfBlob);
  link.download = `${pdfFileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast('PDF 下載已啟動', 'success');
});

// Share Trigger (Web Share API)
sharePdfBtn.addEventListener('click', async () => {
  if (!pdfBlob) return;
  
  const file = new File([pdfBlob], `${pdfFileName}.pdf`, { type: 'application/pdf' });
  
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: pdfFileName,
        text: '這是我用照片轉 PDF App 生成的檔案！'
      });
      showToast('分享成功！', 'success');
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('分享失敗:', err);
        showToast('分享失敗，已自動複製下載連結', 'warning');
      }
    }
  } else {
    showToast('您的裝置不支援直接分享檔案，請使用下載功能。', 'warning');
  }
});

// Close Success Modal
closeSuccessBtn.addEventListener('click', () => {
  successModal.classList.add('hidden');
  pdfBlob = null; // Reset generated blob
});

// ==========================================
// 8. Custom Toast Notification
// ==========================================

function showToast(message, type = 'success') {
  // Remove existing toast if present
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  // Create toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Icons mapping
  let icon = '<i class="fa-solid fa-circle-check"></i>';
  if (type === 'warning') {
    icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
  } else if (type === 'error') {
    icon = '<i class="fa-solid fa-circle-xmark"></i>';
  }
  
  toast.innerHTML = `${icon}<span>${message}</span>`;
  document.body.appendChild(toast);
  
  // Slide in
  setTimeout(() => {
    toast.classList.add('show');
  }, 50);
  
  // Dismiss after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}
