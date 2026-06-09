import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';

// ==========================================
// Helper Functions for Canvas Processing
// ==========================================
const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('圖片載入失敗: ' + e));
    img.src = src;
  });
};

async function processImage(imgObj, quality) {
  const img = await loadImage(imgObj.src);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const rotation = imgObj.rotation;
  
  // Adjust canvas size depending on rotation
  if (rotation === 90 || rotation === 270) {
    canvas.width = img.height;
    canvas.height = img.width;
  } else {
    canvas.width = img.width;
    canvas.height = img.height;
  }
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return {
    dataUrl: dataUrl,
    width: canvas.width,
    height: canvas.height
  };
}

export default function App() {
  // ==========================================
  // States
  // ==========================================
  const [images, setImages] = useState([]);
  const [pdfFileName, setPdfFileName] = useState('My_Converted_Photos');
  const [pageSize, setPageSize] = useState('a4');
  const [pageOrientation, setPageOrientation] = useState('auto');
  const [pageMargin, setPageMargin] = useState(0);
  const [imageQuality, setImageQuality] = useState(0.8);
  
  // Modals & UI States
  const [isDragOver, setIsDragOver] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [progress, setProgress] = useState({ show: false, percent: 0, title: '', desc: '' });
  const [success, setSuccess] = useState({ show: false, size: 0, pages: 0 });
  
  // Refs for persistent variables & inputs
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const pdfBlobRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  
  // Drag and drop sorting refs
  const dragItemRef = useRef(null);
  const dragOverItemRef = useRef(null);

  // ==========================================
  // PWA Install Prompt Listener
  // ==========================================
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      showToast('應用程式安裝成功！', 'success');
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Trigger PWA Installation
  const handleInstallApp = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      console.log(`User response to install: ${outcome}`);
      setInstallPrompt(null);
    }
  };

  // ==========================================
  // Toast Alert System
  // ==========================================
  const showToast = (message, type = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ show: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // ==========================================
  // File Uploading & Processing
  // ==========================================
  const processFiles = (fileList) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    let addedCount = 0;
    const newImages = [];

    Array.from(fileList).forEach(file => {
      if (allowedTypes.includes(file.type)) {
        const id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const src = URL.createObjectURL(file);
        newImages.push({
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
      setImages(prev => [...prev, ...newImages]);
      showToast(`成功匯入 ${addedCount} 張照片`, 'success');
    }
  };

  // Drag and drop files over drop zone
  const handleZoneDragEnter = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleZoneDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleZoneDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = ''; // Reset input value to allow re-uploading the same file
    }
  };

  // ==========================================
  // Preview Grid Actions
  // ==========================================
  const rotateImage = (id) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, rotation: (img.rotation + 90) % 360 } : img
    ));
  };

  const deleteImage = (id) => {
    setImages(prev => {
      const target = prev.find(img => img.id === id);
      if (target) {
        URL.revokeObjectURL(target.src);
      }
      return prev.filter(img => img.id !== id);
    });
  };

  const clearAllImages = () => {
    images.forEach(img => URL.revokeObjectURL(img.src));
    setImages([]);
    showToast('已清除所有選取照片', 'success');
  };

  // ==========================================
  // HTML5 Drag & Drop Sorting for Grid Items
  // ==========================================
  const handleDragStart = (index) => {
    dragItemRef.current = index;
  };

  const handleDragEnter = (index) => {
    dragOverItemRef.current = index;
  };

  const handleDragEnd = () => {
    if (dragItemRef.current !== null && dragOverItemRef.current !== null && dragItemRef.current !== dragOverItemRef.current) {
      setImages(prev => {
        const copy = [...prev];
        const draggedItem = copy[dragItemRef.current];
        copy.splice(dragItemRef.current, 1); // remove
        copy.splice(dragOverItemRef.current, 0, draggedItem); // insert
        return copy;
      });
    }
    dragItemRef.current = null;
    dragOverItemRef.current = null;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // ==========================================
  // PDF Generation Core
  // ==========================================
  const generatePDF = async () => {
    if (images.length === 0) {
      showToast('請先選取或拍攝照片！', 'warning');
      return;
    }

    const cleanFileName = pdfFileName.trim() !== '' ? pdfFileName.trim() : 'My_Converted_Photos';
    setProgress({ show: true, percent: 0, title: '正在準備轉檔...', desc: '正在載入照片資源' });

    try {
      let pdf = null;
      const total = images.length;

      for (let i = 0; i < total; i++) {
        // Small delay to allow react to update the progress bar UI
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const percent = Math.round((i / total) * 100);
        setProgress({
          show: true,
          percent: percent,
          title: `正在處理第 ${i + 1} 頁 (共 ${total} 頁)`,
          desc: `壓縮並轉化: ${images[i].name}`
        });

        // Rotate & compress image via canvas
        const processed = await processImage(images[i], imageQuality);

        // Convert px dimensions to mm (1 px = 0.264583 mm)
        const imgWidthMm = processed.width * 0.264583;
        const imgHeightMm = processed.height * 0.264583;

        // Page Orientation
        let pOrientation = pageOrientation;
        if (pageOrientation === 'auto') {
          pOrientation = (processed.width >= processed.height) ? 'landscape' : 'portrait';
        }

        // Page Size
        let pSize = pageSize;
        let pSizeWidth = 210;
        let pSizeHeight = 297;

        if (pageSize === 'a4') {
          pSizeWidth = (pOrientation === 'portrait') ? 210 : 297;
          pSizeHeight = (pOrientation === 'portrait') ? 297 : 210;
        } else if (pageSize === 'letter') {
          pSizeWidth = (pOrientation === 'portrait') ? 215.9 : 279.4;
          pSizeHeight = (pOrientation === 'portrait') ? 279.4 : 215.9;
        } else if (pageSize === 'auto') {
          pSizeWidth = imgWidthMm + (pageMargin * 2);
          pSizeHeight = imgHeightMm + (pageMargin * 2);
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
        const printableWidth = pSizeWidth - (pageMargin * 2);
        const printableHeight = pSizeHeight - (pageMargin * 2);

        let finalImgWidth = printableWidth;
        let finalImgHeight = (imgHeightMm / imgWidthMm) * finalImgWidth;

        if (finalImgHeight > printableHeight) {
          finalImgHeight = printableHeight;
          finalImgWidth = (imgWidthMm / imgHeightMm) * finalImgHeight;
        }

        // Centered position
        const xOffset = pageMargin + (printableWidth - finalImgWidth) / 2;
        const yOffset = pageMargin + (printableHeight - finalImgHeight) / 2;

        pdf.addImage(processed.dataUrl, 'JPEG', xOffset, yOffset, finalImgWidth, finalImgHeight);
      }

      setProgress(prev => ({ ...prev, percent: 100, title: '完成封裝 PDF...', desc: '正在打包檔案以供下載。' }));
      await new Promise(resolve => setTimeout(resolve, 200));

      // Output PDF blob and cache in Ref
      const blob = pdf.output('blob');
      pdfBlobRef.current = blob;
      const sizeInMB = (blob.size / (1024 * 1024)).toFixed(2);

      setProgress({ show: false, percent: 0, title: '', desc: '' });
      setSuccess({ show: true, size: sizeInMB, pages: total });

    } catch (err) {
      console.error('PDF 生成失敗:', err);
      setProgress({ show: false, percent: 0, title: '', desc: '' });
      showToast('生成 PDF 失敗，請重試或更換照片。', 'error');
    }
  };

  // Download PDF file
  const handleDownload = () => {
    if (!pdfBlobRef.current) return;
    const cleanFileName = pdfFileName.trim() !== '' ? pdfFileName.trim() : 'My_Converted_Photos';
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(pdfBlobRef.current);
    link.download = `${cleanFileName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('PDF 下載已啟動', 'success');
  };

  // Share PDF via Web Share API
  const handleShare = async () => {
    if (!pdfBlobRef.current) return;
    const cleanFileName = pdfFileName.trim() !== '' ? pdfFileName.trim() : 'My_Converted_Photos';
    const file = new File([pdfBlobRef.current], `${cleanFileName}.pdf`, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: cleanFileName,
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
  };

  // ==========================================
  // Render
  // ==========================================
  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-area">
          <div className="logo-icon">
            <i className="fa-solid fa-file-pdf"></i>
          </div>
          <div className="logo-text">
            <h1>PDF Converter</h1>
            <p>照片轉 PDF 專家 <span className="badge offline-badge"><i className="fa-solid fa-wifi-slash"></i> 離線運作</span></p>
          </div>
        </div>
        {installPrompt && (
          <button onClick={handleInstallApp} className="install-btn">
            <i className="fa-solid fa-download"></i> 安裝 App
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Upload Drop Zone */}
        <section className="upload-section card">
          <div 
            className={`drop-zone ${isDragOver ? 'dragover' : ''}`}
            onDragEnter={handleZoneDragEnter}
            onDragOver={handleZoneDragEnter}
            onDragLeave={handleZoneDragLeave}
            onDrop={handleZoneDrop}
            onClick={(e) => {
              // Only trigger if click is not on a button
              if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
                fileInputRef.current.click();
              }
            }}
          >
            {/* Standard file selector */}
            <input 
              type="file" 
              ref={fileInputRef} 
              multiple 
              accept="image/png, image/jpeg, image/webp" 
              className="file-input"
              onChange={handleFileChange}
              style={{ zIndex: 1 }}
            />
            
            <div className="drop-zone-content" style={{ position: 'relative', zIndex: 2, pointerEvents: 'none' }}>
              <div className="upload-icon-wrapper">
                <i className="fa-solid fa-cloud-arrow-up animate-bounce"></i>
              </div>
              <h3>點擊或拖放照片至此處</h3>
              <p className="subtitle">支援多張 JPG, PNG, WEBP 格式</p>
              
              <button 
                className="btn btn-primary btn-upload-trigger"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current.click();
                }}
                style={{ pointerEvents: 'auto' }}
              >
                <i className="fa-solid fa-image"></i> 選擇照片
              </button>
              
              <button 
                className="btn btn-secondary btn-camera-trigger"
                onClick={(e) => {
                  e.stopPropagation();
                  cameraInputRef.current.click();
                }}
                style={{ pointerEvents: 'auto' }}
              >
                <i className="fa-solid fa-camera"></i> 開啟相機
              </button>
            </div>
          </div>
        </section>

        {/* Hidden Camera Input */}
        <input 
          type="file" 
          ref={cameraInputRef} 
          accept="image/*" 
          capture="environment" 
          onChange={(e) => {
            if (e.target.files.length > 0) {
              processFiles(e.target.files);
              e.target.value = '';
            }
          }}
          style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none' }}
        />

        {/* Preview & Order Section */}
        {images.length > 0 && (
          <section className="preview-section card">
            <div className="section-header">
              <h2>已選取照片 (<span>{images.length}</span>)</h2>
              <div className="section-actions">
                <button onClick={clearAllImages} className="btn-text text-danger">
                  <i className="fa-solid fa-trash-can"></i> 全部清除
                </button>
              </div>
            </div>
            <p className="helper-text"><i class="fa-solid fa-arrows-alt"></i> 長按或拖曳照片可調整 PDF 排序</p>
            
            <div className="preview-grid">
              {images.map((imgObj, index) => (
                <div 
                  key={imgObj.id}
                  className="preview-item"
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                >
                  {/* Page number badge */}
                  <div className="page-index">{index + 1}</div>
                  
                  {/* Thumbnail image */}
                  <img 
                    className="preview-thumbnail"
                    src={imgObj.src}
                    alt={imgObj.name}
                    style={{ transform: `rotate(${imgObj.rotation}deg)` }}
                  />

                  {/* Thumbnail Actions */}
                  <div className="item-actions">
                    <button 
                      className="btn-action" 
                      title="旋轉照片"
                      onClick={() => rotateImage(imgObj.id)}
                    >
                      <i className="fa-solid fa-rotate-right"></i>
                    </button>
                    <button 
                      className="btn-action btn-delete" 
                      title="刪除照片"
                      onClick={() => deleteImage(imgObj.id)}
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Settings & Generation Section */}
        {images.length > 0 && (
          <section className="settings-section card">
            <h2>輸出設定</h2>
            
            <div className="settings-grid">
              {/* PDF Name */}
              <div className="setting-item full-width">
                <label htmlFor="pdf-filename">PDF 檔案名稱</label>
                <div className="input-wrapper">
                  <input 
                    type="text" 
                    id="pdf-filename" 
                    value={pdfFileName} 
                    onChange={(e) => setPdfFileName(e.target.value)}
                    placeholder="請輸入檔名"
                  />
                  <span className="suffix">.pdf</span>
                </div>
              </div>

              {/* Page Size */}
              <div className="setting-item">
                <label htmlFor="page-size">紙張尺寸</label>
                <select id="page-size" value={pageSize} onChange={(e) => setPageSize(e.target.value)}>
                  <option value="a4">A4 (210 x 297 mm)</option>
                  <option value="letter">Letter (8.5 x 11 in)</option>
                  <option value="auto">自動 (符合照片比例)</option>
                </select>
              </div>

              {/* Orientation */}
              <div className="setting-item">
                <label htmlFor="page-orientation">紙張方向</label>
                <select id="page-orientation" value={pageOrientation} onChange={(e) => setPageOrientation(e.target.value)}>
                  <option value="auto">自動適應</option>
                  <option value="portrait">直向 (Portrait)</option>
                  <option value="landscape">橫向 (Landscape)</option>
                </select>
              </div>

              {/* Margin */}
              <div className="setting-item">
                <label htmlFor="page-margin">邊距大小</label>
                <select id="page-margin" value={pageMargin} onChange={(e) => setPageMargin(parseInt(e.target.value))}>
                  <option value="0">無邊距 (0mm)</option>
                  <option value="10">小邊距 (10mm)</option>
                  <option value="20">中邊距 (20mm)</option>
                </select>
              </div>

              {/* Quality Slider */}
              <div className="setting-item">
                <label htmlFor="image-quality">圖片品質 (壓縮)</label>
                <select id="image-quality" value={imageQuality} onChange={(e) => setImageQuality(parseFloat(e.target.value))}>
                  <option value="1.0">最佳品質 (無壓縮)</option>
                  <option value="0.8">高 (建議，檔案適中)</option>
                  <option value="0.5">中 (壓縮率高)</option>
                  <option value="0.3">低 (最小檔案)</option>
                </select>
              </div>
            </div>

            {/* Submit Button */}
            <button onClick={generatePDF} className="btn btn-large btn-gradient">
              <i className="fa-solid fa-file-pdf"></i> 生成 PDF 檔案
            </button>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer-info">
        <p>完全本機運作，照片不會上傳到任何伺服器，保護隱私安全。</p>
      </footer>

      {/* Loading / Progress Modal */}
      {progress.show && (
        <div className="modal">
          <div className="modal-content glassmorphism card-modal text-center">
            <div className="spinner-wrapper">
              <div className="custom-spinner"></div>
              <div className="progress-percent">{progress.percent}%</div>
            </div>
            <h3>{progress.title}</h3>
            <p>{progress.desc}</p>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${progress.percent}%` }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {success.show && (
        <div className="modal">
          <div className="modal-content glassmorphism card-modal text-center">
            <div className="success-icon-wrapper">
              <i className="fa-solid fa-circle-check animate-scale"></i>
            </div>
            <h3>PDF 生成成功！</h3>
            <p className="pdf-meta-info">檔案大小: {success.size} MB | 頁數: {success.pages} 頁</p>
            
            <div className="modal-actions">
              <button onClick={handleDownload} className="btn btn-gradient btn-large">
                <i className="fa-solid fa-download"></i> 下載 PDF
              </button>
              <button onClick={handleShare} className="btn btn-secondary btn-large">
                <i className="fa-solid fa-share-nodes"></i> 分享 PDF
              </button>
              <button onClick={() => setSuccess({ show: false, size: 0, pages: 0 })} className="btn btn-text">
                返回修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Toast Alert */}
      {toast.show && (
        <div className={`toast toast-${toast.type} show`}>
          {toast.type === 'success' && <i className="fa-solid fa-circle-check"></i>}
          {toast.type === 'warning' && <i className="fa-solid fa-triangle-exclamation"></i>}
          {toast.type === 'error' && <i className="fa-solid fa-circle-xmark"></i>}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
