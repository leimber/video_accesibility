console.log('Main.js cargado correctamente');
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado, inicializando scripts...');

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const videoUrlInput = document.getElementById('videoUrl');
    const clearUrlBtn = document.getElementById('clearUrl');
    const fileInput = document.getElementById('videoFile');
    const uploadArea = document.querySelector('.upload-area');
    const processingStatus = document.getElementById('processingStatus');
    const uploadPreview = document.getElementById('uploadPreview');
    const videoPreview = document.getElementById('videoPreview');
    const removeVideoBtn = document.getElementById('removeVideo');
    const processBtn = document.getElementById('processBtn');
    const progressBar = document.querySelector('.progress-bar');
    const statusText = document.getElementById('statusText');
    const estimatedTime = document.getElementById('estimatedTime');
    const resultsSection = document.getElementById('resultsSection');

    let currentVideoId = null;
    let processingInterval = null;

    // Clear URL button
    clearUrlBtn?.addEventListener('click', function() {
        videoUrlInput.value = '';
    });

    // File upload handling
    fileInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (file) {
            try {
                if (!validateFile(file)) {
                    throw new Error('Archivo no válido. Solo se permiten videos de hasta 100MB.');
                }
                
                showFilePreview(file);
                updateStep(2);
            } catch (error) {
                showError('Error al seleccionar el archivo: ' + error.message);
            }
        }
    });

    // Drag and drop functionality
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragging');
    });

    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        this.classList.remove('dragging');
    });

    uploadArea.addEventListener('drop', async function(e) {
        e.preventDefault();
        this.classList.remove('dragging');
        const file = e.dataTransfer.files[0];
        
        if (file && file.type.startsWith('video/')) {
            try {
                if (!validateFile(file)) {
                    throw new Error('Archivo no válido. Solo se permiten videos de hasta 100MB.');
                }
                
                fileInput.files = e.dataTransfer.files;
                showFilePreview(file);
                updateStep(2);
            } catch (error) {
                showError('Error al procesar el archivo: ' + error.message);
            }
        }
    });

    // Process button click
    processBtn.addEventListener('click', async function() {
        try {
            updateStep(3);
            showProcessingStatus();
            
            // Preparar el formulario
            const formData = new FormData();
            
            // Añadir video o URL
            if (fileInput.files.length > 0) {
                formData.append('video', fileInput.files[0]);
            } else if (videoUrlInput.value) {
                formData.append('youtube_url', videoUrlInput.value);
            } else {
                throw new Error('Por favor, proporciona un archivo de video o una URL de YouTube');
            }
            
            // Añadir opciones
            formData.append('generate_audiodesc', document.getElementById('audioDesc').checked);
            formData.append('generate_subtitles', document.getElementById('subtitles').checked);
            formData.append('subtitle_format', 'srt'); // Valor por defecto
            formData.append('target_language', 'es'); // Valor por defecto

            // Enviar a la API correcta
            const response = await fetch('/api/v1/videos/process', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error al iniciar el procesamiento');
            }
            
            const data = await response.json();
            currentVideoId = data.video_id;
            startProcessingCheck();
            
        } catch (error) {
            console.error('Error processing:', error);
            showError('Error al procesar el video: ' + error.message);
        }
    });

    // Remove video button
    removeVideoBtn?.addEventListener('click', function() {
        resetUpload();
    });

    // Helper functions
    function validateFile(file) {
        const maxSize = 100 * 1024 * 1024; // 100MB
        const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'];
        return file.size <= maxSize && (validTypes.includes(file.type) || file.type.startsWith('video/'));
    }

    function showFilePreview(file) {
        const url = URL.createObjectURL(file);
        videoPreview.src = url;
        uploadPreview.classList.remove('d-none');
    }

    function showProcessingStatus() {
        processingStatus.classList.remove('d-none');
    }

    function showError(message) {
        console.error('Error:', message);
        const alert = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        processingStatus.innerHTML = alert;
        processingStatus.classList.remove('d-none');
    }

    function resetUpload() {
        fileInput.value = '';
        videoPreview.src = '';
        uploadPreview.classList.add('d-none');
        processingStatus.classList.add('d-none');
        if (resultsSection) {
            resultsSection.classList.add('d-none');
        }
        currentVideoId = null;
        if (processingInterval) {
            clearInterval(processingInterval);
        }
        updateStep(1);
    }

    function updateStep(step) {
        document.querySelectorAll('.stepper-item').forEach((item, index) => {
            if (index + 1 < step) {
                item.classList.add('completed');
                item.classList.remove('active');
            } else if (index + 1 === step) {
                item.classList.add('active');
                item.classList.remove('completed');
            } else {
                item.classList.remove('active', 'completed');
            }
        });
    }

    function startProcessingCheck() {
        let progress = 0;
        processingInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/v1/videos/${currentVideoId}/status`);
                if (!response.ok) {
                    throw new Error('Error al verificar el estado');
                }
                
                const status = await response.json();
                console.log('Status update:', status);
                
                // Update progress
                if (status.progress !== undefined) {
                    progress = status.progress;
                    progressBar.style.width = `${progress}%`;
                }
                
                // Update status message
                if (status.current_step) {
                    statusText.textContent = status.current_step;
                }
                
                // Calculate estimated time
                if (progress > 0) {
                    const timeRemaining = Math.round((100 - progress) / (progress / 10));
                    estimatedTime.textContent = `Tiempo estimado: ${timeRemaining} segundos`;
                }

                // Check if processing is completed
                if (status.status === 'completed') {
                    clearInterval(processingInterval);
                    updateStep(4);
                    await handleProcessingResults(currentVideoId);
                } 
                // Check for errors
                else if (status.status === 'error') {
                    clearInterval(processingInterval);
                    showError(status.error || 'Error en el procesamiento');
                }
            } catch (error) {
                console.error('Error checking status:', error);
                clearInterval(processingInterval);
                showError('Error al verificar el estado del procesamiento');
            }
        }, 2000);
    }

    // Results handling
    async function handleProcessingResults(videoId) {
        try {
            const response = await fetch(`/api/v1/videos/${videoId}/result`);
            if (!response.ok) {
                throw new Error('Error al obtener resultados');
            }
            
            const results = await response.json();
            console.log('Processing results:', results);
            
            // Si hay un elemento de resultados, mostrarlo
            if (resultsSection) {
                resultsSection.classList.remove('d-none');
                
                // Si hay un elemento para descargas, actualizarlo
                const downloadTab = document.getElementById('downloadTab');
                if (downloadTab) {
                    let downloadContent = '<div class="list-group">';
                    
                    if (results.outputs && results.outputs.subtitles) {
                        downloadContent += `
                            <a href="/api/v1/subtitles/${videoId}?download=true" class="list-group-item list-group-item-action">
                                <i class="bi bi-card-text"></i> Subtítulos
                                <span class="badge bg-info float-end">SRT</span>
                            </a>
                        `;
                    }
                    
                    if (results.outputs && results.outputs.audio_description) {
                        downloadContent += `
                            <a href="/api/v1/audiodesc/${videoId}?download=true" class="list-group-item list-group-item-action">
                                <i class="bi bi-file-earmark-music"></i> Audiodescripción
                                <span class="badge bg-success float-end">WAV</span>
                            </a>
                        `;
                    }
                    
                    downloadContent += `</div>
                    <div class="mt-3">
                        <h6>Procesamiento completado</h6>
                        <p>ID del video: ${videoId}</p>
                    </div>`;
                    
                    downloadTab.innerHTML = downloadContent;
                }
                
                // Si hay un elemento de video para reproducir los resultados
                const resultVideo = document.getElementById('resultVideo');
                if (resultVideo && results.outputs && results.outputs.subtitles) {
                    // Limpiar tracks existentes
                    while (resultVideo.firstChild) {
                        resultVideo.removeChild(resultVideo.firstChild);
                    }
                    
                    // Añadir subtítulos
                    const track = document.createElement('track');
                    track.kind = 'subtitles';
                    track.label = 'Español';
                    track.srclang = 'es';
                    track.src = `/api/v1/subtitles/${videoId}?download=true`;
                    resultVideo.appendChild(track);
                }
            } else {
                // Si no hay sección de resultados, mostrar un mensaje
                const successMessage = `
                    <div class="alert alert-success">
                        <h4>¡Procesamiento completado!</h4>
                        <p>El video ha sido procesado correctamente.</p>
                        <div class="mt-2">
                            <a href="/api/v1/subtitles/${videoId}?download=true" class="btn btn-primary">Descargar Subtítulos</a>
                            ${results.outputs && results.outputs.audio_description ? 
                            `<a href="/api/v1/audiodesc/${videoId}?download=true" class="btn btn-secondary ms-2">Descargar Audiodescripción</a>` 
                            : ''}
                        </div>
                    </div>
                `;
                processingStatus.innerHTML = successMessage;
            }
        } catch (error) {
            console.error('Error al obtener resultados:', error);
            showError('Error al cargar los resultados del procesamiento');
        }
    }
});});