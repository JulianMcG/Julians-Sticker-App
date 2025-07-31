class StickerLayoutApp {
    constructor() {
        this.canvas = document.getElementById('stickerCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.randomizeBtn = document.getElementById('randomizeBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.backBtn = document.getElementById('backBtn');
        this.sizeSlider = document.getElementById('sizeSlider');
        this.sizeValue = document.getElementById('sizeValue');
        this.logoSizeSlider = document.getElementById('logoSizeSlider');
        this.logoSizeValue = document.getElementById('logoSizeValue');
        this.ratio32Btn = document.getElementById('ratio32Btn');
        this.ratio1610Btn = document.getElementById('ratio1610Btn');
        this.logoToggle = document.getElementById('logoToggle');
        
        this.stickers = [];
        this.previousLayout = null; // Store previous layout for back button
        this.stickerSize = 150; // All stickers will be the same size
        this.logoSize = 40; // Logo size
        this.aspectRatio = '3:2'; // Current aspect ratio
        this.canvasWidth = 900;
        this.canvasHeight = 600;
        this.logoEnabled = false;
        this.logoAnimationProgress = 1; // Start fully visible
        this.draggedSticker = null;
        this.isDragging = false;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.clearCanvas();
    }
    
    setupEventListeners() {
        // Drag and drop
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });
        
        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('dragover');
        });
        
        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files);
            this.handleFiles(files);
        });
        
        // Click to upload
        this.uploadArea.addEventListener('click', () => {
            this.fileInput.click();
        });
        
        this.fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.handleFiles(files);
        });
        
        // Buttons
        this.randomizeBtn.addEventListener('click', () => {
            this.randomizeLayout();
        });
        
        this.clearBtn.addEventListener('click', () => {
            this.clearAll();
        });
        
        this.backBtn.addEventListener('click', () => {
            this.goBack();
        });
        
        // Aspect ratio buttons
        this.ratio32Btn.addEventListener('click', () => {
            this.setAspectRatio('3:2');
        });
        
        this.ratio1610Btn.addEventListener('click', () => {
            this.setAspectRatio('16:10');
        });
        
        // Logo toggle
        this.logoToggle.addEventListener('change', (e) => {
            this.logoEnabled = e.target.checked;
            this.updateLogoSizeControl();
            
            if (this.logoEnabled) {
                this.animateLogoAppearance();
            } else {
                this.logoAnimationProgress = 1;
            }
            
            if (this.stickers.length > 0) {
                this.randomizeLayout();
            }
        });
        
        // Size slider
        this.sizeSlider.addEventListener('input', (e) => {
            this.stickerSize = parseInt(e.target.value);
            this.sizeValue.textContent = this.stickerSize + 'px';
            this.updateStickerSizes();
        });
        
        // Logo size slider
        this.logoSizeSlider.addEventListener('input', (e) => {
            this.logoSize = parseInt(e.target.value);
            this.logoSizeValue.textContent = this.logoSize + 'px';
            this.render();
        });
        
        // Initialize logo size control state
        this.updateLogoSizeControl();
        
        // Canvas mouse events for manual movement
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('contextmenu', (e) => this.handleRightClick(e));
    }
    
    async handleFiles(files) {
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length === 0) {
            alert('Please select image files only.');
            return;
        }
        
        this.uploadArea.classList.add('loading');
        
        try {
            for (const file of imageFiles) {
                const sticker = await this.createSticker(file);
                this.stickers.push(sticker);
            }
            
            this.randomizeLayout();
        } catch (error) {
            console.error('Error loading images:', error);
            alert('Error loading some images. Please try again.');
        } finally {
            this.uploadArea.classList.remove('loading');
        }
    }
    
    async createSticker(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                // Create a temporary canvas to resize the image at higher resolution
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                
                // Use 2x resolution for crisp rendering
                const renderSize = this.stickerSize * 2;
                tempCanvas.width = renderSize;
                tempCanvas.height = renderSize;
                
                // Calculate scaling to fit the image within the sticker size
                const scale = Math.min(
                    renderSize / img.width,
                    renderSize / img.height
                );
                
                const scaledWidth = img.width * scale;
                const scaledHeight = img.height * scale;
                
                // Center the image in the sticker
                const x = (renderSize - scaledWidth) / 2;
                const y = (renderSize - scaledHeight) / 2;
                
                tempCtx.drawImage(img, x, y, scaledWidth, scaledHeight);
                
                resolve({
                    image: tempCanvas,
                    originalImage: img, // Store the original image for resizing
                    x: 0,
                    y: 0,
                    rotation: 0
                });
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }
    
    randomizeLayout() {
        if (this.stickers.length === 0) {
            alert('Please upload some images first!');
            return;
        }
        
        // Save current layout before randomizing
        this.saveCurrentLayout();
        
        // Shuffle the stickers array to swap positions
        this.shuffleStickers();
        
        // Store current positions for animation
        const currentPositions = this.stickers.map(sticker => ({
            x: sticker.x,
            y: sticker.y,
            rotation: sticker.rotation
        }));
        
        // Calculate new positions
        const gridCols = Math.ceil(Math.sqrt(this.stickers.length));
        const gridRows = Math.ceil(this.stickers.length / gridCols);
        
        const cellWidth = this.canvasWidth / gridCols;
        const cellHeight = this.canvasHeight / gridRows;
        
        const newPositions = [];
        
        // Semi-even distribution with randomness
        this.stickers.forEach((sticker, index) => {
            const col = index % gridCols;
            const row = Math.floor(index / gridCols);
            
            // Base position in grid
            const baseX = col * cellWidth + cellWidth / 2;
            const baseY = row * cellHeight + cellHeight / 2;
            
            // Add randomness within the cell
            const randomX = (Math.random() - 0.5) * (cellWidth * 0.6);
            const randomY = (Math.random() - 0.5) * (cellHeight * 0.6);
            
            // Get position with boundary checking
            const position = this.getValidPosition(baseX + randomX, baseY + randomY);
            
            // Random rotation (mostly upright with slight tilting)
            const maxRotation = Math.PI / 6; // 30 degrees
            const newRotation = (Math.random() - 0.5) * maxRotation;
            
            newPositions.push({ x: position.x, y: position.y, rotation: newRotation });
        });
        
        // Animate the transition
        this.animateStickers(currentPositions, newPositions);
    }
    
    animateStickers(fromPositions, toPositions) {
        const duration = 600; // Animation duration in milliseconds
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function for smooth animation
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            
            // Update sticker positions
            this.stickers.forEach((sticker, index) => {
                const from = fromPositions[index];
                const to = toPositions[index];
                
                if (from && to) {
                    sticker.x = from.x + (to.x - from.x) * easeOutQuart;
                    sticker.y = from.y + (to.y - from.y) * easeOutQuart;
                    
                    // Interpolate rotation (handle angle wrapping)
                    let rotationDiff = to.rotation - from.rotation;
                    if (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
                    if (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;
                    
                    sticker.rotation = from.rotation + rotationDiff * easeOutQuart;
                }
            });
            
            this.render();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
    

    
    animateLogoAppearance() {
        this.logoAnimationProgress = 0;
        const duration = 600; // Animation duration in milliseconds
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function for smooth animation
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            
            this.logoAnimationProgress = easeOutQuart;
            this.render();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    updateLogoSizeControl() {
        const logoSizeControl = document.querySelector('.logo-size-control');
        if (this.logoEnabled) {
            logoSizeControl.classList.add('enabled');
        } else {
            logoSizeControl.classList.remove('enabled');
        }
    }
    
    getValidPosition(x, y) {
        const margin = this.stickerSize / 2;
        let validX = Math.max(margin, Math.min(this.canvasWidth - margin, x));
        let validY = Math.max(margin, Math.min(this.canvasHeight - margin, y));
        
        // If logo is enabled, avoid the center area
        if (this.logoEnabled) {
            const logoRadius = this.logoSize; // Logo radius
            const logoMargin = this.stickerSize / 2; // Sticker radius
            const totalAvoidanceRadius = logoRadius + logoMargin;
            
            const centerX = this.canvasWidth / 2;
            const centerY = this.canvasHeight / 2;
            const distance = Math.sqrt((validX - centerX) ** 2 + (validY - centerY) ** 2);
            
            if (distance < totalAvoidanceRadius) {
                // Move sticker away from logo area (edge-to-edge distance)
                const angle = Math.atan2(validY - centerY, validX - centerX);
                validX = centerX + Math.cos(angle) * totalAvoidanceRadius;
                validY = centerY + Math.sin(angle) * totalAvoidanceRadius;
                
                // Ensure it's still within bounds
                validX = Math.max(margin, Math.min(this.canvasWidth - margin, validX));
                validY = Math.max(margin, Math.min(this.canvasHeight - margin, validY));
            }
        }
        
        return { x: validX, y: validY };
    }
    
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if clicking on a sticker
        for (let i = this.stickers.length - 1; i >= 0; i--) {
            const sticker = this.stickers[i];
            const distance = Math.sqrt((x - sticker.x) ** 2 + (y - sticker.y) ** 2);
            
            if (distance <= this.stickerSize / 2) {
                this.draggedSticker = sticker;
                this.isDragging = true;
                this.canvas.style.cursor = 'grabbing';
                break;
            }
        }
    }
    
    handleMouseMove(e) {
        if (this.isDragging && this.draggedSticker) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const position = this.getValidPosition(x, y);
            this.draggedSticker.x = position.x;
            this.draggedSticker.y = position.y;
            
            this.render();
        }
    }
    
    handleMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.draggedSticker = null;
            this.canvas.style.cursor = 'default';
        }
    }
    
    handleRightClick(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if right-clicking on a sticker
        for (let i = this.stickers.length - 1; i >= 0; i--) {
            const sticker = this.stickers[i];
            const distance = Math.sqrt((x - sticker.x) ** 2 + (y - sticker.y) ** 2);
            
            if (distance <= this.stickerSize / 2) {
                this.stickers.splice(i, 1);
                this.render();
                break;
            }
        }
    }
    
    shuffleStickers() {
        // Fisher-Yates shuffle algorithm
        for (let i = this.stickers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.stickers[i], this.stickers[j]] = [this.stickers[j], this.stickers[i]];
        }
    }
    
    saveCurrentLayout() {
        if (this.stickers.length > 0) {
            this.previousLayout = this.stickers.map(sticker => ({
                x: sticker.x,
                y: sticker.y,
                rotation: sticker.rotation,
                image: sticker.image,
                originalImage: sticker.originalImage
            }));
        }
    }
    
    goBack() {
        if (this.previousLayout) {
            this.stickers = this.previousLayout.map(sticker => ({
                x: sticker.x,
                y: sticker.y,
                rotation: sticker.rotation,
                image: sticker.image,
                originalImage: sticker.originalImage
            }));
            this.previousLayout = null; // Clear the previous layout after going back
            this.render();
        } else {
            alert('No previous layout to go back to!');
        }
    }
    
    render() {
        this.clearCanvas();
        
        // Draw logo if enabled (always visible when enabled)
        if (this.logoEnabled) {
            this.drawLogo();
        }
        
        this.stickers.forEach(sticker => {
            this.ctx.save();
            this.ctx.translate(sticker.x, sticker.y);
            this.ctx.rotate(sticker.rotation);
            this.ctx.drawImage(
                sticker.image,
                -this.stickerSize / 2,
                -this.stickerSize / 2,
                this.stickerSize,
                this.stickerSize
            );
            this.ctx.restore();
        });
    }
    
    drawLogo() {
        const centerX = this.canvasWidth / 2;
        const centerY = this.canvasHeight / 2;
        const radius = this.logoSize;
        
        // Draw logo circle with animation
        this.ctx.save();
        
        // Apply fade and scale effects if logo is just appearing
        if (this.logoAnimationProgress < 1) {
            const alpha = this.logoAnimationProgress;
            const scale = 0.5 + (this.logoAnimationProgress * 0.5);
            
            this.ctx.globalAlpha = alpha;
            this.ctx.translate(centerX, centerY);
            this.ctx.scale(scale, scale);
            this.ctx.translate(-centerX, -centerY);
        }
        
        this.ctx.fillStyle = '#000000'; // Black color
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.restore();
    }
    
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        this.ctx.fillStyle = '#6b7280';
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    }
    
    updateStickerSizes() {
        if (this.stickers.length === 0) return;
        
        // Recreate all stickers with the new size
        this.stickers.forEach(sticker => {
            const originalImage = sticker.originalImage;
            if (originalImage) {
                // Create a temporary canvas to resize the image at higher resolution
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                
                // Use 2x resolution for crisp rendering
                const renderSize = this.stickerSize * 2;
                tempCanvas.width = renderSize;
                tempCanvas.height = renderSize;
                
                // Calculate scaling to fit the image within the sticker size
                const scale = Math.min(
                    renderSize / originalImage.width,
                    renderSize / originalImage.height
                );
                
                const scaledWidth = originalImage.width * scale;
                const scaledHeight = originalImage.height * scale;
                
                // Center the image in the sticker
                const x = (renderSize - scaledWidth) / 2;
                const y = (renderSize - scaledHeight) / 2;
                
                tempCtx.drawImage(originalImage, x, y, scaledWidth, scaledHeight);
                
                sticker.image = tempCanvas;
            }
        });
        
        this.render();
    }
    
    setAspectRatio(ratio) {
        this.aspectRatio = ratio;
        
        // Update button states
        this.ratio32Btn.classList.toggle('active', ratio === '3:2');
        this.ratio1610Btn.classList.toggle('active', ratio === '16:10');
        
        // Store current dimensions for animation
        const oldWidth = this.canvasWidth;
        const oldHeight = this.canvasHeight;
        
        // Update canvas dimensions
        if (ratio === '3:2') {
            this.canvasWidth = 900;
            this.canvasHeight = 600;
        } else {
            this.canvasWidth = 960;
            this.canvasHeight = 600;
        }
        
        // Animate canvas resize
        this.animateCanvasResize(oldWidth, oldHeight);
    }
    
    animateCanvasResize(oldWidth, oldHeight) {
        const duration = 300;
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            
            // Interpolate dimensions
            const currentWidth = oldWidth + (this.canvasWidth - oldWidth) * easeOutQuart;
            const currentHeight = oldHeight + (this.canvasHeight - oldHeight) * easeOutQuart;
            
            // Update canvas element
            this.canvas.width = currentWidth;
            this.canvas.height = currentHeight;
            
            // Re-render
            this.render();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Final render with correct dimensions
                this.canvas.width = this.canvasWidth;
                this.canvas.height = this.canvasHeight;
                this.render();
                
                // Re-randomize if there are stickers
                if (this.stickers.length > 0) {
                    this.randomizeLayout();
                }
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    clearAll() {
        this.stickers = [];
        this.previousLayout = null;
        this.clearCanvas();
        this.fileInput.value = '';
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new StickerLayoutApp();
}); 