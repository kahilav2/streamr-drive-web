import utils from "./utils/utils.js"
import StreamrMessageController from "./message-controller.js"
import { Editor } from 'https://esm.sh/@tiptap/core'
import StarterKit from 'https://esm.sh/@tiptap/starter-kit'
import Link from 'https://esm.sh/@tiptap/extension-link'
import Underline from 'https://esm.sh/@tiptap/extension-underline'
import TextAlign from 'https://esm.sh/@tiptap/extension-text-align'
import Image from 'https://esm.sh/@tiptap/extension-image'

export default {
  template: `
  <div 
    class="app-container" 
    @dragover.prevent="handleDragOver" 
    @dragleave.prevent="handleDragLeave" 
    @drop.prevent="handleDrop"
    @paste.prevent="handlePaste"
    :class="{ 'drag-over': isDraggingOver }"
  >
    <div v-if="state === 'dashboard'" class="hamburger-menu" @click="isSideMenuOpen = !isSideMenuOpen"/>
    <transition name="slide">
      <div
        v-if="isSideMenuOpen" class="side-menu">
        <div class="container">
          <h1 class="title mb-3">Streamr Drive (25-Apr26.0)</h1>
          <div class="mb-2"><b>Stream Address:</b> {{ streamUrl }}</div>
          <button class="mb-2" @click="changeAccount">Change Account</button>
          <div class="mb-2">Scan this QR code with another device to connect to this account</div>
          <button class="mb-2" @click="toggleQrCode">{{ showQrCode ? 'Hide QR Code' : 'Show QR Code' }}</button>
          <div id="qrcode" class="mb-2" v-show="showQrCode"></div>
        </div>
      </div>
    </transition>
    <canvas ref="canvas" hidden></canvas>
    <video ref="video" hidden></video>
    <div ref="topSection" class="top-section">

      <div v-if="errorMessages.length > 0" class="error-messages">
        <li v-for="errorMessage in errorMessages">
          {{ errorMessage }}
        </li>
      </div>
      <div v-if="state === 'start'">
        <div class="intro-title centered centered-vertically">
          <div>Streamr Drive</div>
          <button class="button centered" @click="state = 'setup'">Set up</button>
        </div>
      </div>

      <div v-else-if="state === 'setup' && state !== 'camera'">
        <div class="setup-container centered">
          <div class="center-div">
            <button class="button mb-2" @click="scanQrCode">Scan QR Code</button>
          </div>
          <div class="center-div">
            <div class="mb-2">Or</div>
          </div>
          <div v-if="!showManualPrivateKeyInput" class="center-div">
            <button class="button mb-2" @click="showManualPrivateKeyInput=true">Input private key manually</button>
          </div>
          <template v-if="showManualPrivateKeyInput">
            <label>Private Key:</label>
            <div class="private-key-field">
              <input
                class="mb-1"
                :type="showKeyInput ? 'text' : 'password'"
                v-model="privateKey"
              />
              <button type="button" @click="showKeyInput = !showKeyInput">
                {{ showKeyInput ? 'Hide' : 'Show' }}
              </button>
            </div>
            <label>Stream ID:</label>
            <input type="text" class="mb-1" v-model="streamId"/>
            <div class="center-div">
              <button class="mb-2" @click="submitConfigForm" >Submit</button>
            </div>
          </template>
        </div>
      </div>
      <div v-else-if="state === 'connect'">
        <div class="text-centered centered-vertically">
          <img src="assets/logo.svg" alt="Loading..." style="width: 30vw; height: auto; display: block; margin: 0 auto 1rem auto;" />
        </div>
      </div>

      <div v-else-if="state === 'dashboard'" class="dashboard-container">
        <div class="connection-indicator" :class="{ connected: isServerConnected }"></div>
        <div class="file-explorer">
          <div class="file-explorer-header">
            <div class="path-navigation">
              <span class="path-item" @click="navigateTo('')">Storage</span>
              <template v-for="(segment, index) in currentPath.split('/').filter(Boolean)">
                <span class="path-separator">/</span>
                <span class="path-item" @click="navigateTo(currentPath.split('/').slice(0, index + 1).join('/'))">{{ segment }}</span>
              </template>
            </div>
            <div class="file-actions">
              <button class="refresh-btn" @click="refreshFilesList">
                <span class="refresh-icon">↻</span>
              </button>
              <div class="dropdown">
                <button class="add-btn" @click="toggleDropdown('newFileDropdown')">
                  <span>+</span>
                </button>
                <div class="dropdown-content" id="newFileDropdown">
                  <button @click="showCreateDirectoryDialog">New Folder</button>
                  <button @click="showNewTextFileDialog">New Text File</button>
                  <button @click="showNewTiptapDialog">New Tiptap Document</button>
                </div>
              </div>
              <button class="upload-btn" @click="$refs.fileUpload.click()">
                <span>Upload</span>
                <input hidden ref="fileUpload" @change="uploadFile" type="file" accept="*/*" />
              </button>
            </div>
          </div>

          <div v-if="isLoading || Object.keys(activeDownloads).length > 0 || Object.keys(activeUploads).length > 0" class="loading-indicator">
            <div v-if="isLoading" class="spinner"></div>
            <div v-if="isLoading">Loading...</div>
            
            <!-- Upload progress bars -->
            <div v-for="(progress, messageId) in activeUploads" :key="'up-'+messageId" class="upload-progress">
              <div>Uploading: {{ progress.percentage }}%</div>
              <div class="progress-bar">
                <div class="progress-bar-fill" :style="{ width: progress.percentage + '%' }"></div>
              </div>
              <div>{{ progress.received }} of {{ progress.total }} chunks</div>
            </div>
            
            <!-- Download progress bars -->
            <div v-for="(progress, messageId) in activeDownloads" :key="'down-'+messageId" class="download-progress">
              <div>Downloading: {{ progress.percentage }}%</div>
              <div class="progress-bar">
                <div class="progress-bar-fill download" :style="{ width: progress.percentage + '%' }"></div>
              </div>
              <div>{{ progress.received }} of {{ progress.total }} chunks</div>
            </div>
          </div>
          
          <div v-else-if="files.length === 0" class="empty-dir">
            <div>This folder is empty</div>
          </div>
          
          <div v-else class="file-list">
            <div v-for="file in files" :key="file.name" class="file-item">
              <div class="file-icon" :class="{ 'directory-icon': file.isDirectory, 'file-icon': !file.isDirectory }"></div>
              <div class="file-details" 
                   :style="{ cursor: file.isDirectory || isPreviewable(file.name) ? 'pointer' : 'default' }" 
                   @click="handleFileClick(file)">
                <div class="file-name">{{ file.name }}</div>
                <div class="file-info">{{ file.isDirectory ? 'Directory' : formatFileSize(file.size) }}</div>
              </div>
              <div class="file-actions">
                <i v-if="!file.isDirectory" 
                   class="fa fa-download action-icon" 
                   @click="downloadFile(file.name, true)"></i>
                <div class="dropdown action-menu">
                  <i class="fa fa-ellipsis-v action-icon" @click="toggleDropdown('actionMenu' + file.name)"></i>
                  <div class="dropdown-content" :id="'actionMenu' + file.name">
                    <button @click="showRenameDialog(file)">Rename</button>
                    <button @click="deleteItem(file.name, file.isDirectory)">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="downloadedFiles.length > 0" class="downloaded-files">
          <div class="collapsible-header" @click="isTransferredFilesOpen = !isTransferredFilesOpen">
            <h3>Transferred Files ({{ downloadedFiles.length }})</h3>
            <span class="collapse-arrow" :class="{'open': isTransferredFilesOpen}">▶</span>
          </div>
          <div v-if="isTransferredFilesOpen" class="file-list">
            <div v-for="(file, index) in downloadedFiles" :key="index" class="file-item">
              <div class="file-icon file-icon"></div>
              <div class="file-details">
                <div class="file-name">{{ file.fileName }}</div>
                <div class="file-info">{{ formatFileSize(file.fileSize || 0) }}</div>
              </div>
              <div class="file-actions">
                <button @click="saveToDisk(file, index)" class="icon-button">
                  <i class="fa fa-download"></i>
                </button>
                <button v-if="isPreviewable(file.fileName)" 
                        @click="editDownloadedFile(file, index)" 
                        class="icon-button">
                  <i class="fa fa-search"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Toast Notifications -->
        <div class="toast-container">
          <transition-group name="toast">
            <div v-for="toast in toasts" :key="toast.id" class="toast" :class="toast.type">
              {{ toast.message }}
            </div>
          </transition-group>
        </div>

        <!-- Create Directory Dialog -->
        <div v-if="showDirectoryDialog" class="dialog-overlay">
          <div class="dialog">
            <h3>Create New Directory</h3>
            <input type="text" v-model="newDirectoryName" placeholder="Directory name" @keyup.enter="createDirectory" />
            <div class="dialog-actions">
              <button @click="showDirectoryDialog = false">Cancel</button>
              <button @click="createDirectory">Create</button>
            </div>
          </div>
        </div>

        <!-- New Document Dialog -->
        <div v-if="showDocumentDialog" class="dialog-overlay">
          <div class="dialog">
            <h3>{{ 
              dialogAction === 'textfile' ? 'Create New Text File' : 
              dialogAction === 'tiptap' ? 'Create New Tiptap Document' :
              'Create New Document' 
            }}</h3>
            <input type="text" v-model="newDocumentName" 
                  :placeholder="
                    dialogAction === 'textfile' ? 'Text file name' : 
                    dialogAction === 'tiptap' ? 'Tiptap document name' :
                    'Document name'
                  " 
                  @keyup.enter="
                    dialogAction === 'textfile' ? createEmptyTextFile() : 
                    createEmptyTiptapDocument()
                  " />
            <div class="dialog-actions">
              <button @click="showDocumentDialog = false">Cancel</button>
              <button @click="
                dialogAction === 'textfile' ? createEmptyTextFile() : 
                dialogAction === 'tiptap'
              ">
                Create
              </button>
            </div>
          </div>
        </div>

        <!-- Rename Dialog -->
        <div v-if="showRenameDialogFlag" class="dialog-overlay">
          <div class="dialog">
            <h3>Rename {{ itemToRename.isDirectory ? 'Directory' : 'File' }}</h3>
            <input type="text" v-model="newItemName" placeholder="New name" @keyup.enter="renameItem" />
            <div class="dialog-actions">
              <button @click="showRenameDialogFlag = false">Cancel</button>
              <button @click="renameItem">Rename</button>
            </div>
          </div>
        </div>

        <!-- Tiptap Editor Dialog -->
        <div v-if="showTiptapEditor" class="editor-dialog-overlay">
          <div class="editor-dialog">
            <div class="editor-header">
              <h3>{{ editingFileName }}</h3>
              <div class="editor-actions">
                <button @click="saveTiptapDocument">Save</button>
                <button @click="closeTiptapEditor">Close</button>
              </div>
            </div>
            <div id="tiptapEditorContainer"></div>
          </div>
        </div>

        <!-- Text Editor Dialog -->
        <div v-if="showTextEditor" class="editor-dialog-overlay">
          <div class="editor-dialog">
            <div class="editor-header">
              <h3>{{ editingFileName }}</h3>
              <div class="editor-actions">
                <button @click="saveTextDocument">Save</button>
                <button @click="closeTextEditor">Close</button>
              </div>
            </div>
            <div id="textEditorContainer">
              <textarea id="textEditorTextarea"></textarea>
            </div>
          </div>
        </div>

        <!-- Image Preview Dialog -->
        <div v-if="showImagePreview" class="editor-dialog-overlay">
          <div class="editor-dialog image-preview-dialog">
            <div class="editor-header">
              <h3>{{ editingFileName }}</h3>
              <div class="editor-actions">
                <button @click="closeImagePreview">Close</button>
              </div>
            </div>
            <div class="image-preview-container">
              <img :src="imagePreviewSrc" alt="Image preview" class="preview-image" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`,
  
  data() {
    return {
      messageController: null,
      privateKey: '',
      streamUrl: '',
      streamId: '',
      publicAddress: '',
      isSideMenuOpen: false,
      showQrCode: false,
      showKeyInput: false,
      state: 'start',
      networkConnected: false,
      showManualPrivateKeyInput: false,
      streamrCli: null,
      error: null,
      errorMessages: [],
      showDocumentDialog: false,
      newDocumentName: "",
      isConnected: false,
      deviceId: "",

      // Toast notifications
      toasts: [],
      toastIdCounter: 0,
      hasReceivedOneSuccessfulResponse: false,
      
      // File explorer
      files: [],
      currentPath: "",
      isLoading: false,
      
      // Downloaded files
      downloadedFiles: [],
      
      // Create directory dialog
      showDirectoryDialog: false,
      newDirectoryName: "",
      
      // Server connection status
      isServerConnected: false,
      lastPingTime: 0,
      lastPongTime: 0,
      pingInterval: null,
      connectionCheckInterval: null,
      
      // File upload tracking
      uploadProgress: {},
      activeUploads: {},
      downloadProgress: {},
      activeDownloads: {},

      // Text editor
      showTextEditor: false,
      textEditorContent: '',
      textEditorInstance: null,

      // Rename dialog
      showRenameDialogFlag: false,
      itemToRename: {},
      newItemName: "",

      // Image preview
      showImagePreview: false,
      imagePreviewSrc: '',

      pendingFileToOpen: null,
      pendingFileToDownload: null,

      dialogAction: 'document',

      // Collapsible state for transferred files
      isTransferredFilesOpen: false,

      // Add a property to track current open dropdown
      currentOpenDropdown: null,

      // Tiptap editor
      showTiptapEditor: false,
      tiptapEditor: null,
      
      // Drag and drop state
      isDraggingOver: false,
    }
  },

  created() {
    this.initializeApp();
  },

  mounted() {
    // Add event listener to close dropdowns when clicking outside
    document.addEventListener('click', this.closeDropdowns);
  },

  beforeUnmount() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }
    // Remove the event listener when component is destroyed
    document.removeEventListener('click', this.closeDropdowns);
  },

  watch: {
    isSideMenuOpen(newVal) {
      if (newVal) {
        this.$nextTick(() => {
          new QRCode("qrcode").makeCode(JSON.stringify({ k: this.privateKey, id: this.streamId }));
        });
      }
    },
  },

  methods: {
    initializeApp() {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js');
      }

      const config = this.loadConfig();
      if (config) {
        Object.assign(this, config);
        this.connect();
      }
    },

    loadConfig() {
      const configString = localStorage.getItem(STORAGE_ITEM_ID);
      if (!configString) {
        console.log("Config has not been set");
        return null;
      }

      try {
        return JSON.parse(configString);
      } catch(err) {
        this.errorMessages = [err.toString()];
        return null;
      }
    },
    toggleQrCode() {
      this.showQrCode = !this.showQrCode;
    },

    openImagePreview(file, index) {
      this.editingFileName = file.fileName;
      this.editingFileIndex = index;
      
      // Create a blob URL for the image data
      const blob = this.convertBase64ToBlob(file.body, file.contentType || this.getContentTypeFromFileName(file.fileName));
      this.imagePreviewSrc = URL.createObjectURL(blob);
      
      this.showImagePreview = true;
    },

    closeImagePreview() {
      if (this.imagePreviewSrc) {
        URL.revokeObjectURL(this.imagePreviewSrc);
        this.imagePreviewSrc = '';
      }
      this.showImagePreview = false;
      this.editingFileName = '';
      this.editingFileIndex = -1;
    },    

    getContentTypeFromFileName(fileName) {
      const extension = fileName.toLowerCase().split('.').pop();
      const mimeTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp',
        'svg': 'image/svg+xml'
      };
      return mimeTypes[extension] || 'application/octet-stream';
    },

    async changeAccount() {
      localStorage.removeItem(STORAGE_ITEM_ID);
      this.state = 'start';
      this.isSideMenuOpen = false;
      this.files = [];
      this.downloadedFiles = [];
      this.currentPath = "";
      this.isServerConnected = false;
      
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
      }
      if (this.connectionCheckInterval) {
        clearInterval(this.connectionCheckInterval);
      }
      
      await this.streamrCli?.destroy();
      await this.messageController?.destroy();
    },

    async submitConfigForm() {
      if (!this.privateKey || !this.streamId) {
        this.errorMessages = ["Provide both private key and stream ID"];
        return;
      }

      this.errorMessages = [];
      this.saveConfig();
      this.connect();
    },

    saveConfig() {
      if (!this.deviceId) {
        this.deviceId = utils.generateUniqueId();
      }
      localStorage.setItem(STORAGE_ITEM_ID, JSON.stringify({ 
        privateKey: this.privateKey, 
        streamId: this.streamId, 
        deviceId: this.deviceId 
      }));
    },
    
    async connect() {
      this.state = 'connect';
      try {
        await this.initializeMessageController();
        await this.initializeStreamrClient();
        this.isConnected = true;
        this.state = 'dashboard';
        
        // Start ping/pong to check server connection
        this.startPingPong();
        
        // Wait for server connection before listing files
        this.waitForServerConnection();
      } catch (error) {
        this.errorMessages = [error.toString()];
        this.state = 'start';
      }
    },

    async initializeMessageController() {
      this.messageController = new StreamrMessageController({ deviceId: this.deviceId });
      await this.messageController.init();
      this.messageController.on("message", this.messageHandler);
      this.messageController.on("publish", this.handleMessagePublish);
    },

    generateTimestampedImageName(mimeType) {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.toLocaleString('en-US', { month: 'short' }); // e.g., 'Apr'
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');

      // Determine file extension from MIME type
      let extension = 'png'; // Default extension
      if (mimeType === 'image/jpeg') {
        extension = 'jpg';
      } else if (mimeType === 'image/gif') {
        extension = 'gif';
      } else if (mimeType === 'image/webp') {
        extension = 'webp';
      } else if (mimeType === 'image/bmp') {
        extension = 'bmp';
      } else if (mimeType.startsWith('image/')) {
         // Fallback for other image types like svg+xml, tiff etc.
         extension = mimeType.split('/')[1].split('+')[0]; 
      }

      return `Image-${year}-${month}-${day}-${hours}${minutes}.${extension}`;
    },
    async handlePaste(event) {
      if (this.state !== 'dashboard') {
        console.log("Paste ignored: Not in dashboard state.");
        return; // Only handle paste in dashboard view
      }

      const items = event.clipboardData.items;
      if (!items) {
        console.log("Paste ignored: No clipboard items found.");
        return;
      }

      let fileToUpload = null;

      console.log(`Found ${items.length} clipboard items.`);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        console.log(`Item ${i}: kind=${item.kind}, type=${item.type}`);

        // Check if it's a file (includes images pasted from clipboard)
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            // If it's an image file from the clipboard (often named generically like 'image.png')
            // or any file pasted from the filesystem.
            if (item.type.startsWith('image/')) {
              // Generate a timestamped name specifically for pasted image data
              const newName = this.generateTimestampedImageName(file.type);
              // Create a new File object with the generated name to ensure consistency
              fileToUpload = new File([file], newName, { type: file.type });
              console.log(`Identified pasted image. Generated name: ${newName}`);
            } else {
              // It's a non-image file pasted from the filesystem
              fileToUpload = file;
              console.log(`Identified pasted file: ${file.name}`);
            }
            break; // Process the first valid file/image found
          }
        }
      }

      if (fileToUpload) {
        await this.processAndUploadFile(fileToUpload);
      } else {
        console.log("Paste ignored: No suitable file or image content found in clipboard.");
        // Optionally show a toast message if nothing usable was pasted
        // this.showToast("Clipboard does not contain a file or image to upload.", 'info');
      }
    },

    async handleMessagePublish(msg) {
      try {
        this.streamrChunker.publish(msg);
      } catch(err) {
        console.error("Error publishing message:", err);
        this.errorMessages = [err.toString()];
      }
    },
    
    async initializeStreamrClient() {
      this.streamrCli = new StreamrClient({
        contracts: {
          rpcs: [{
            url: "https://polygon-bor-rpc.publicnode.com"
          }]
        },
        auth: { privateKey: this.privateKey }
      });

      this.publicAddress = await this.streamrCli.getAddress();
      this.streamUrl = `${this.publicAddress}/${this.streamId}`;
      const stream = await this.streamrCli.getStream(this.streamUrl);
      await this.streamrCli.subscribe(this.streamUrl, this.handleStreamrMessage);
      console.log("Streamr client initialized and subscribed to stream:", this.streamUrl);

      this.initializeStreamrChunker();
    },

    initializeStreamrChunker() {
      this.streamrChunker = new StreamrChunker.StreamrChunker()
        .withDeviceId(this.deviceId)
        .withIgnoreOwnMessages()
        .withMaxMessageSize(8*64000)
    
      this.streamrChunker.on("publish", this.publishToStreamr);
      this.streamrChunker.on("message", this.handleChunkerMessage);
      
      // Add listener for chunk-update event to track download progress
      this.streamrChunker.on("chunk-update", (updateData) => {
        this.handleChunkUpdate(updateData);
      });
    },

    async publishToStreamr(msg) {
      try {
        await this.streamrCli.publish(this.streamUrl, msg);
      } catch(err) {
        console.error(err);
        this.errorMessages = [err.toString()];
      }
    },
    showToast(message, type = 'success') {
      const id = this.toastIdCounter++;
      const toast = {
        id,
        message,
        type
      };
      
      // Add the toast to the array
      this.toasts.push(toast);
      
      // Set timeout to remove the toast
      setTimeout(() => {
        this.removeToast(id);
      }, type === 'error' ? 10000 : 2000);
    },
    
    removeToast(id) {
      const index = this.toasts.findIndex(toast => toast.id === id);
      if (index !== -1) {
        this.toasts.splice(index, 1);
      }
    },

    handleStreamrMessage(msg) {
      try {
        this.streamrChunker.receiveHandler(msg);
      } catch(err) {
        console.error(err);
      }
    },

    handleChunkerMessage(msg) {
      try {
        this.messageController.receiveHandler(msg);
      } catch(err) {
        console.error(err);
      }
    },
    openTiptapEditor(file, index) {
      this.editingFileName = file.fileName;
      this.editingFileIndex = index;
      
      // Try to parse the content as JSON, or start with empty content if it fails
      let content = {};
      try {
        const decoder = new TextDecoder('utf-8');
        const bytes = Uint8Array.from(atob(file.body), c => c.charCodeAt(0));
        const textContent = decoder.decode(bytes);
        content = JSON.parse(textContent);
      } catch (e) {
        console.error('Error parsing Tiptap content:', e);
        content = { type: 'doc', content: [{ type: 'paragraph' }] };
      }
      
      // Show the editor
      this.showTiptapEditor = true;
      
      // Initialize Tiptap on next tick to ensure DOM is updated
      this.$nextTick(() => {
        // Clean up any existing editor
        if (this.tiptapEditor) {
          this.tiptapEditor.destroy();
          this.tiptapEditor = null;
        }
        
        // Initialize the Tiptap editor with enhanced controls
        const editorContainer = document.getElementById('tiptapEditorContainer');
        editorContainer.innerHTML = `
          <div class="tiptap-toolbar">
            <!-- Text styling -->
            <button class="tiptap-toolbar-btn" data-command="bold" title="Bold">B</button>
            <button class="tiptap-toolbar-btn" data-command="italic" title="Italic">I</button>
            <button class="tiptap-toolbar-btn" data-command="underline" title="Underline">U</button>
            
            <!-- Heading controls -->
            <div class="tiptap-toolbar-group">
              <button class="tiptap-toolbar-btn" data-command="h1" title="Heading 1">H1</button>
              <button class="tiptap-toolbar-btn" data-command="h2" title="Heading 2">H2</button>
              <button class="tiptap-toolbar-btn" data-command="h3" title="Heading 3">H3</button>
            </div>
            
            <!-- Image insertion -->
            <button class="tiptap-toolbar-btn" data-command="image" title="Insert Image">🖼️</button>
            <input type="file" id="image-upload" accept="image/*" style="display: none;">
          </div>
          <div id="tiptapEditor"></div>
        `;
        
        // Add some custom CSS for font sizes
        const style = document.createElement('style');
        style.textContent = `
          .tiptap-editor-content .is-small { font-size: 0.8em; }
          .tiptap-editor-content .is-normal { font-size: 1em; }
          .tiptap-editor-content .is-large { font-size: 1.2em; }
          .tiptap-editor-content .is-huge { font-size: 1.5em; }
          
          .tiptap-toolbar {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            padding: 8px;
          }
          
          .tiptap-toolbar-btn {
            padding: 5px 10px;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 3px;
            cursor: pointer;
          }
          
          .tiptap-toolbar-btn:hover {
            background: #f0f0f0;
          }
          
          .tiptap-toolbar-group {
            display: flex;
            gap: 2px;
          }
          
          .tiptap-font-size {
            padding: 5px;
            border: 1px solid #ddd;
            border-radius: 3px;
          }
        `;
        document.head.appendChild(style);
        
        // Create the editor and make it globally accessible
        window.editor = new Editor({
          element: document.getElementById('tiptapEditor'),
          extensions: [
            StarterKit,
            Image.configure({
              inline: false,
              allowBase64: true,
              HTMLAttributes: {
                class: 'tiptap-image',
              },
            }),
            Link,
            Underline,
            TextAlign.configure({
              types: ['heading', 'paragraph'],
            }),
          ],
          content: content,
          editorProps: {
            attributes: {
              class: 'tiptap-editor-content',
            }
          }
        });
        
        // Store a reference to the editor
        this.tiptapEditor = window.editor;
        
        // Add event listeners for toolbar buttons
        document.querySelectorAll('.tiptap-toolbar-btn').forEach(button => {
          button.addEventListener('click', () => {
            const command = button.getAttribute('data-command');
            
            if (command === 'bold') {
              window.editor.chain().focus().toggleBold().run();
            } else if (command === 'italic') {
              window.editor.chain().focus().toggleItalic().run();
            } else if (command === 'underline') {
              window.editor.chain().focus().toggleUnderline().run();
            } else if (command === 'h1') {
              window.editor.chain().focus().toggleHeading({ level: 1 }).run();
            } else if (command === 'h2') {
              window.editor.chain().focus().toggleHeading({ level: 2 }).run();
            } else if (command === 'h3') {
              window.editor.chain().focus().toggleHeading({ level: 3 }).run();
            } else if (command === 'image') {
              document.getElementById('image-upload').click();
            }
          });
        });
                
        // Add event listener for image upload
        document.getElementById('image-upload').addEventListener('change', this.handleImageUpload);
      });
    },
    
    handleImageUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      if (!file.type.startsWith('image/')) {
        this.showToast("Please select an image file", 'error');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => {
        try {
          // Access editor via window.editor instead of this.tiptapEditor
          if (window.editor) {
            // Simple approach that should work regardless of TipTap version
            window.editor.chain()
              .focus()
              .setImage({ 
                src: reader.result,
                alt: file.name || 'Uploaded image' 
              })
              .run();
            
            this.showToast("Image inserted successfully", 'success');
          }
        } catch (error) {
          console.error('Error inserting image:', error);
          this.showToast("Failed to insert image: " + error.message, 'error');
        }
        
        // Reset the file input for future uploads
        event.target.value = '';
      };
      reader.readAsDataURL(file);
    },

    messageHandler(msg) {
      if (msg.type === 'text') {
        try {
          const response = JSON.parse(msg.body);
          
          // Handle success/error toasts
          if (response.status === 'success') {
            let actionMessage = '';
            
            if (!this.hasReceivedOneSuccessfulResponse) {
              this.hasReceivedOneSuccessfulResponse = true;
              actionMessage = 'Connected';
            }

            // Create human-readable success messages based on action
            if (response.action === 'upload') {
              actionMessage = 'File uploaded successfully';
            } else if (response.action === 'download') {
              // actionMessage = 'File download initiated';
            } else if (response.action === 'rename') {
              actionMessage = `Item renamed successfully`;
            } else if (response.action === 'delete') {
              actionMessage = `${response.fileName || 'Item'} deleted successfully`;
            } else if (response.action === 'mkdir') {
              actionMessage = 'Directory created successfully';
            } else if (response.action === 'list') {
              // Don't show toast for list action
            } else if (response.action === 'pong') {
            }
            
            // Show success toast if we have a message
            if (actionMessage) {
              this.showToast(actionMessage, 'success');
            }
          } else if (response.status === 'error') {
            // Show error toast with the error message
            this.showToast(response.message, 'error');
            this.errorMessages = [response.message];
            this.isLoading = false;
          }

          // Handle upload progress response
          if (response.action === 'upload-progress') {
            this.handleUploadProgress(response);
            return;
          }
          
          // Handle download progress response
          if (response.action === 'download-progress') {
            this.handleDownloadProgress(response);
            return;
          }
          
          // Handle pong response
          if ((response.action === 'pong') || 
              (response.action === 'ping' && response.status === 'success' && response.message === 'pong')) {
            this.lastPongTime = Date.now();
            this.isServerConnected = true;
            return;
          }
          
          // Handle list response
          if (response.action === 'list' && response.status === 'success') {
            this.files = response.files || [];
            this.isLoading = false;
            return;
          }
          
          // Handle upload response
          if (response.action === 'upload' && response.status === 'success') {
            // Clear any upload progress entries when upload is complete
            this.activeUploads = {};
            this.refreshFilesList();
            return;
          }

          // Handle rename response
          if (response.action === 'rename' && response.status === 'success') {
            this.refreshFilesList();
            return;
          }
          
          // Handle download response
          if (response.action === 'download' && response.status === 'success') {
            // Don't clear downloads yet - the file is still being transferred
            // We'll clear them when the file is actually received
            this.isLoading = false;
            return;
          }
          
          // Handle delete response
          if (response.action === 'delete' && response.status === 'success') {
            this.refreshFilesList();
            return;
          }
          
          // Handle mkdir response
          if (response.action === 'mkdir' && response.status === 'success') {
            this.refreshFilesList();
            return;
          }
          
          // Handle error responses
          if (response.status === 'error') {
            this.errorMessages = [response.message];
            this.isLoading = false;
            return;
          }
        } catch (err) {
          console.error('Error parsing response:', err);
        }
      } else if (msg.type === 'file') {
        // Store downloaded file and reset loading state
        console.log('File received:', msg.fileName, 'Current downloaded files:', this.downloadedFiles.length);
        this.downloadedFiles.push(msg);
        
        // Get the index of the newly added file
        const index = this.downloadedFiles.length - 1;
        
        // Check if this file was requested to be opened
        if (this.pendingFileToOpen && this.pendingFileToOpen === msg.fileName) {
          this.pendingFileToOpen = null;
          
          // Auto-open the file in appropriate editor
          this.$nextTick(() => {
            const fileName = msg.fileName.toLowerCase();
            if (fileName.endsWith('.txt')) {
              this.openTextEditor(msg, index);
            } else if (fileName.endsWith('.tiptap')) {
              this.openTiptapEditor(msg, index);
            } else {
              const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
              if (imageExtensions.some(ext => fileName.endsWith(ext))) {
                this.openImagePreview(msg, index);
              }
            }
          });
        }
        
        // Check if this file was requested to be saved directly to disk
        if (this.pendingFileToDownload && this.pendingFileToDownload === msg.fileName) {
          this.pendingFileToDownload = null;
          
          // Auto-save the file to disk
          this.$nextTick(() => {
            this.saveToDisk(msg, index);
          });
        }
        
        // Clear any download progress entries when file is received
        this.activeDownloads = {};
        this.isLoading = false;

        // this.showToast(`File "${msg.fileName}" downloaded successfully`, 'success');
      }
    },
    
    handleUploadProgress(response) {
      const { messageId, received, total, progress, complete } = response;
      
      // Update progress tracking
      this.uploadProgress[messageId] = {
        received,
        total,
        percentage: Math.round(progress), // Use the progress value from the server
        complete
      };
      
      // Update active uploads for display without using $set/$delete
      if (!complete) {
        // Create a new object to trigger reactivity
        const updatedUploads = { ...this.activeUploads };
        updatedUploads[messageId] = this.uploadProgress[messageId];
        this.activeUploads = updatedUploads;
      } else {
        // Create a new object without the completed upload
        const updatedUploads = { ...this.activeUploads };
        delete updatedUploads[messageId];
        this.activeUploads = updatedUploads;
      }
      
      console.log(`Upload progress: ${received}/${total} chunks (${progress}%)`);
    },

    // Handle chunk updates from StreamrChunker for downloads
    handleChunkUpdate(updateData) {
      try {
        // Process chunk updates for downloads
        for (const update of updateData) {
          const { messageId, lastChunkId, progress } = update;
          
          // Calculate total chunks and received chunks
          const total = lastChunkId + 1;
          const progressPercent = parseFloat(progress);
          const received = Math.round((progressPercent / 100) * total);
          
          // Update the download progress tracking
          this.downloadProgress[messageId] = {
            messageId,
            received,
            total,
            percentage: Math.round(progressPercent),
            complete: progressPercent === 100
          };
          
          // Create a new object to trigger reactivity
          const updatedDownloads = { ...this.activeDownloads };
          
          if (progressPercent < 100) {
            updatedDownloads[messageId] = this.downloadProgress[messageId];
          } else {
            delete updatedDownloads[messageId];
          }
          
          this.activeDownloads = updatedDownloads;
          
          console.log(`Download progress: ${received}/${total} chunks (${progressPercent}%)`);
        }
      } catch (error) {
        console.error('Error handling chunk update:', error);
      }
    },
    
    // Handle download progress updates from the server
    handleDownloadProgress(response) {
      const { messageId, received, total, progress, complete } = response;
      
      // Update progress tracking
      this.downloadProgress[messageId] = {
        received,
        total,
        percentage: Math.round(progress),
        complete
      };
      
      // Update active downloads for display
      if (!complete) {
        // Create a new object to trigger reactivity
        const updatedDownloads = { ...this.activeDownloads };
        updatedDownloads[messageId] = this.downloadProgress[messageId];
        this.activeDownloads = updatedDownloads;
      } else {
        // Create a new object without the completed download
        const updatedDownloads = { ...this.activeDownloads };
        delete updatedDownloads[messageId];
        this.activeDownloads = updatedDownloads;
      }
      
      console.log(`Download progress: ${received}/${total} chunks (${progress}%)`);
    },

    startPingPong() {
      // Send ping every 4 seconds (as per your current code)
      this.pingInterval = setInterval(() => {
        this.sendPing();
      }, 4000);
      
      // Check connection status every second
      this.connectionCheckInterval = setInterval(() => {
        const timeSinceLastPong = Date.now() - this.lastPongTime;
        if (timeSinceLastPong > 15000) {
          console.log('No pong received for 15 seconds, we have lost connection to the other end');
          this.isServerConnected = false;
        }
      }, 1000);
      
      // Initialize lastPongTime to avoid immediate disconnection
      this.lastPongTime = Date.now();
      
      // Send initial ping
      this.sendPing();
    },
    
    async sendPing() {
      this.lastPingTime = Date.now();
      try {
        await this.messageController.upload({
          type: "text",
          body: JSON.stringify({ action: "ping" })
        });
      } catch (error) {
        console.error('Error sending ping:', error);
      }
    },
    
    async waitForServerConnection() {
      // Wait for server connection (max 30 seconds)
      const startTime = Date.now();
      const checkConnection = setInterval(() => {
        if (this.isServerConnected) {
          clearInterval(checkConnection);
          this.listFiles();
        } else if (Date.now() - startTime > 30000) {
          clearInterval(checkConnection);
          this.errorMessages = ["Failed to connect to server. Please try again."];
        }
      }, 1000);
    },
    
    async listFiles() {
      this.isLoading = true;
      try {
        await this.messageController.upload({
          type: "text",
          body: JSON.stringify({
            action: "list",
            path: this.currentPath
          })
        });
      } catch (error) {
        console.error('Error listing files:', error);
        this.errorMessages = [error.toString()];
        this.isLoading = false;
      }
    },
    
    async refreshFilesList() {
      await this.listFiles();
    },
    
    async navigateTo(path) {
      this.currentPath = path;
      await this.listFiles();
    },
    handleDragOver(event) {
      // Only activate drop zone effect in the dashboard state
      if (this.state === 'dashboard') {
        this.isDraggingOver = true;
      }
    },
    handleDragLeave(event) {
      // Check if the leave event is actually leaving the intended drop zone
      // This helps prevent flickering when dragging over child elements
      if (!event.currentTarget.contains(event.relatedTarget)) {
         this.isDraggingOver = false;
      }
    },
    handleDrop(event) {
      this.isDraggingOver = false;
      
      // Only allow drops in the dashboard state
      if (this.state !== 'dashboard') {
        return;
      }

      const files = event.dataTransfer.files;
      if (!files || files.length === 0) {
        return;
      }

      // Prevent opening the file in the browser
      event.preventDefault(); 

      console.log(`Dropped ${files.length} files.`);

      // Process each dropped file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`Processing dropped file: ${file.name}`);
        // Call the refactored upload logic
        this.processAndUploadFile(file); 
      }
    },
    async uploadFile(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      this.processAndUploadFile(file);
      
      // Clear the file input
      event.target.value = '';
    },

    async processAndUploadFile(file) {
      this.isLoading = true; // Consider moving this inside the upload logic if handling multiple files
      try {
        const base64String = await this.fileToBase64(file);
        
        // Use a separate messageId for tracking this specific upload if needed
        // For simplicity, we'll rely on the general isLoading for now.
        // If you need per-file progress, you'd generate a unique ID here.
        
        await this.messageController.upload({
          type: "text",
          body: JSON.stringify({
            action: "upload",
            path: this.currentPath,
            fileName: file.name,
            data: base64String.split(',')[1] 
          })
        });
        // Don't reset isLoading here - it will be reset when upload is complete or fails
        this.showToast(`Uploading ${file.name}...`, 'success'); 
      } catch (error) {
        console.error('Error uploading file:', file.name, error);
        this.errorMessages.push(`Error uploading ${file.name}: ${error.toString()}`);
        this.showToast(`Error uploading ${file.name}`, 'error');
        // Only reset isLoading if all uploads failed or if handling one file at a time
        // For multiple files, you might need more sophisticated state management.
        this.isLoading = false; 
      }
    },
    
    async downloadFile(fileName, saveDirectly = false) {
      this.isLoading = true;
      
      // Set the pending download flag if requested to save directly
      if (saveDirectly) {
        this.pendingFileToDownload = fileName;
      }
      
      try {
        await this.messageController.upload({
          type: "text",
          body: JSON.stringify({
            action: "download",
            path: this.currentPath,
            fileName: fileName
          })
        });
      } catch (error) {
        console.error('Error downloading file:', error);
        this.errorMessages = [error.toString()];
        this.isLoading = false;
        
        // Clear pending flags if there's an error
        if (saveDirectly) this.pendingFileToDownload = null;
      }
    },

    showRenameDialog(file) {
      this.itemToRename = file;
      this.newItemName = file.name;
      this.showRenameDialogFlag = true;
      this.$nextTick(() => {
        document.querySelector('.dialog input').focus();
        
        // Select the filename part without the extension for easier editing
        const input = document.querySelector('.dialog input');
        if (file.isDirectory) {
          // For directories, select the entire name
          input.setSelectionRange(0, this.newItemName.length);
        } else {
          // For files, select only the name part, not the extension
          const lastDotIndex = this.newItemName.lastIndexOf('.');
          if (lastDotIndex !== -1) {
            input.setSelectionRange(0, lastDotIndex);
          } else {
            input.setSelectionRange(0, this.newItemName.length);
          }
        }
      });
    },
    
    async renameItem() {
      if (!this.newItemName || this.newItemName === this.itemToRename.name) {
        this.showRenameDialogFlag = false;
        return;
      }
      
      this.isLoading = true;
      this.showRenameDialogFlag = false;
      
      try {
        await this.messageController.upload({
          type: "text",
          body: JSON.stringify({
            action: "rename",
            path: this.currentPath,
            oldName: this.itemToRename.name,
            newName: this.newItemName
          })
        });
      } catch (error) {
        console.error('Error renaming item:', error);
        this.errorMessages = [error.toString()];
        this.isLoading = false;
      }
    },  
    
    async deleteItem(name, isDirectory) {
      if (!confirm(`Are you sure you want to delete ${isDirectory ? 'directory' : 'file'} "${name}"?`)) {
        return;
      }
      
      this.isLoading = true;
      try {
        await this.messageController.upload({
          type: "text",
          body: JSON.stringify({
            action: "delete",
            path: this.currentPath,
            fileName: name
          })
        });
      } catch (error) {
        console.error('Error deleting item:', error);
        this.errorMessages = [error.toString()];
        this.isLoading = false;
      }
    },
    
    showCreateDirectoryDialog() {
      this.showDirectoryDialog = true;
      this.newDirectoryName = '';
      this.$nextTick(() => {
        document.querySelector('.dialog input').focus();
      });
    },
    
    async createDirectory() {
      if (!this.newDirectoryName) return;
      
      this.showDirectoryDialog = false;
      this.isLoading = true;
      try {
        await this.messageController.upload({
          type: "text",
          body: JSON.stringify({
            action: "mkdir",
            path: this.currentPath,
            dirName: this.newDirectoryName
          })
        });
      } catch (error) {
        console.error('Error creating directory:', error);
        this.errorMessages = [error.toString()];
        this.isLoading = false;
      }
    },
    
    async saveDownloadedFile(file, index) {
      try {
        // If it's a Tiptap document, open it in the Tiptap editor
        if (file.fileName.toLowerCase().endsWith('.tiptap')) {
          this.openTiptapEditor(file, index);
          return;
        }
        
        // If it's a text file, open it in the text editor
        if (file.fileName.toLowerCase().endsWith('.txt')) {
          this.openTextEditor(file, index);
          return;
        }
        
        // Otherwise, download the file as before
        const blob = this.convertBase64ToBlob(file.body, file.contentType);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.fileName;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error saving file:', error);
        this.errorMessages = [error.toString()];
      }
    },
    
    convertBase64ToBlob(base64String, contentType = 'application/octet-stream') {
      const byteCharacters = atob(base64String);
      const byteArrays = [];
      
      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
      }
      
      return new Blob(byteArrays, { type: contentType });
    },
    
    fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
      });
    },
    
    formatFileSize(size) {
      if (size < 1024) return `${size} B`;
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
      if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
      return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    },

    scanQrCodeFrame(ctx) {
      const { video, canvas } = this.$refs;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        requestAnimationFrame(() => this.scanQrCodeFrame(ctx));
        return;
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      
      if (code) {
        this.handleQrCodeScanned(code.data);
      } else {
        requestAnimationFrame(() => this.scanQrCodeFrame(ctx));
      }
    },
  
    handleQrCodeScanned(data) {
      console.log("QR Code scanned:", data);
      this.stopVideoStream();
      this.$refs.canvas.hidden = true;
      
      try {
        const scannedData = JSON.parse(data);
        if (scannedData.k && scannedData.id) {
          this.privateKey = scannedData.k;
          this.streamId = scannedData.id;
          this.saveConfig();
          this.connect();
        } else {
          throw new Error("Invalid QR code format");
        }
      } catch (error) {
        console.error("Error processing QR code:", error);
        this.errorMessages = ["Invalid QR code. Please try again."];
      }
  
      this.state = 'setup';
    },
  
    stopVideoStream() {
      if (this.$refs.video.srcObject) {
        this.$refs.video.srcObject.getTracks().forEach(track => track.stop());
      }
    },

    async scanQrCode() {
      this.state = 'camera';
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const video = this.$refs.video;
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        video.play();
        video.addEventListener("loadedmetadata", () => this.setupCanvas());
      } catch (error) {
        console.error("Error accessing camera:", error);
        this.errorMessages = ["Failed to access camera. Please check permissions."];
      }
    },
  
    setupCanvas() {
      const { video, canvas } = this.$refs;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.hidden = false;
      
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      this.scanQrCodeFrame(ctx);
    },

    showNewDocumentDialog() {
      this.showDocumentDialog = true;
      this.newDocumentName = '';
      this.dialogAction = 'document';
      this.$nextTick(() => {
        document.querySelector('.dialog input').focus();
      });
    },
    showNewTextFileDialog() {
      this.showDocumentDialog = true;
      this.newDocumentName = '';
      this.dialogAction = 'textfile';
      this.$nextTick(() => {
        document.querySelector('.dialog input').focus();
      });
    },    

    async createEmptyTextFile() {
      if (!this.newDocumentName) return;
      
      // Add .txt extension if not present
      let fileName = this.newDocumentName;
      if (!fileName.toLowerCase().endsWith('.txt')) {
        fileName += '.txt';
      }
      
      this.showDocumentDialog = false;
      this.isLoading = true;
      try {
        // Create an empty text file - encode empty string as base64
        const emptyTextBase64 = btoa(' ');
        await this.messageController.upload({
          type: "text",
          body: JSON.stringify({
            action: "upload",
            path: this.currentPath,
            fileName: fileName,
            data: emptyTextBase64
          })
        });
        await this.listFiles();
    
      } catch (error) {
        console.error('Error creating empty text file:', error);
        this.errorMessages = [error.toString()];
        this.isLoading = false;
      }
    }, 
        
    openTextEditor(file, index) {
      this.editingFileName = file.fileName;
      this.editingFileIndex = index;
      
      // Convert Base64 to text content
      const decoder = new TextDecoder('utf-8');
      const bytes = Uint8Array.from(atob(file.body), c => c.charCodeAt(0));
      this.textEditorContent = decoder.decode(bytes);
      
      // Show the editor
      this.showTextEditor = true;
      
      // Initialize EasyMDE on next tick to ensure DOM is updated
      this.$nextTick(() => {
        if (this.textEditorInstance) {
          this.textEditorInstance.toTextArea();
          this.textEditorInstance = null;
        }
        
        // Initialize the EasyMDE editor on the existing textarea
        const textarea = document.getElementById('textEditorTextarea');
        textarea.value = this.textEditorContent;
        
        this.textEditorInstance = new EasyMDE({
          element: textarea,
          autoDownloadFontAwesome: true,
          autofocus: true,
          spellChecker: false,
          status: ['lines', 'words', 'cursor']
        });
      });
    },
    
    saveTextDocument() {
      if (!this.textEditorInstance) return;
      
      const content = this.textEditorInstance.value();
      
      // Update the content in the downloadedFiles array
      const file = this.downloadedFiles[this.editingFileIndex];
      
      // Convert content to Base64
      const base64Content = btoa(unescape(encodeURIComponent(content)));
      this.downloadedFiles[this.editingFileIndex].body = base64Content;
      
      // Upload to the current path
      this.uploadTextFile(this.editingFileName, base64Content);
      
      // Close the editor
      this.closeTextEditor();
    },
    
    closeTextEditor() {
      if (this.textEditorInstance) {
        this.textEditorInstance.toTextArea();
        this.textEditorInstance = null;
      }
      this.showTextEditor = false;
      this.editingFileName = '';
      this.textEditorContent = '';
    },
    
    async uploadTextFile(fileName, base64Content) {
      this.isLoading = true;
      try {
        await this.messageController.upload({
          type: "text",
          body: JSON.stringify({
            action: "upload",
            path: this.currentPath,
            fileName: fileName,
            data: base64Content
          })
        });
      } catch (error) {
        console.error('Error uploading text file:', error);
        this.errorMessages = [error.toString()];
      } finally {
        this.isLoading = false;
      }
    },

    // Add these new methods
    isPreviewable(fileName) {
      if (!fileName) return false;
      const lowerCaseName = fileName.toLowerCase();
      
      // Text files
      if (lowerCaseName.endsWith('.txt') || lowerCaseName.endsWith('.tiptap')) {
        return true;
      }
      
      // Image files
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
      return imageExtensions.some(ext => lowerCaseName.endsWith(ext));
    },

    saveTiptapDocument() {
      if (!this.tiptapEditor) return;
      
      try {
        // Get the content as JSON
        const content = this.tiptapEditor.getJSON();
        
        // Convert to string and then to Base64
        const contentString = JSON.stringify(content);
        const base64Content = btoa(unescape(encodeURIComponent(contentString)));
        
        // Update the downloadedFiles array
        this.downloadedFiles[this.editingFileIndex].body = base64Content;
        
        // Upload the file to the server
        this.uploadTiptapFile(this.editingFileName, base64Content);
                
        // Close the editor
        this.closeTiptapEditor();
      } catch (error) {
        console.error('Error saving Tiptap document:', error);
        this.errorMessages = [error.toString()];
      }
    },  
    
    closeTiptapEditor() {
      if (this.tiptapEditor) {
        this.tiptapEditor.destroy();
        this.tiptapEditor = null;
        window.editor = null; // Remove the global reference
      }
      this.showTiptapEditor = false;
      this.editingFileName = '';
      this.editingFileIndex = -1;
    },

    async uploadTiptapFile(fileName, base64Content) {
      this.isLoading = true;
      try {
        await this.messageController.upload({
          type: "text",
          body: JSON.stringify({
            action: "upload",
            path: this.currentPath,
            fileName: fileName,
            data: base64Content
          })
        });
      } catch (error) {
        console.error('Error uploading Tiptap file:', error);
        this.errorMessages = [error.toString()];
      } finally {
        this.isLoading = false;
      }
    },

    async createEmptyTiptapDocument() {
      if (!this.newDocumentName) return;
      
      // Add .tiptap extension if not present
      let fileName = this.newDocumentName;
      if (!fileName.toLowerCase().endsWith('.tiptap')) {
        fileName += '.tiptap';
      }
      
      this.showDocumentDialog = false;
      this.isLoading = true;
      try {
        // Create an empty Tiptap document - basic JSON structure
        const emptyTiptapDoc = {
          type: 'doc',
          content: [
            {
              type: 'paragraph'
            }
          ]
        };
        
        // Convert to JSON string and then to base64
        const contentString = JSON.stringify(emptyTiptapDoc);
        const base64Content = btoa(unescape(encodeURIComponent(contentString)));
        
        await this.messageController.upload({
          type: "text",
          body: JSON.stringify({
            action: "upload",
            path: this.currentPath,
            fileName: fileName,
            data: base64Content
          })
        });
        
        await this.listFiles();
      } catch (error) {
        console.error('Error creating empty Tiptap document:', error);
        this.errorMessages = [error.toString()];
        this.isLoading = false;
      }
    },

    showNewTiptapDialog() {
      this.showDocumentDialog = true;
      this.newDocumentName = '';
      this.dialogAction = 'tiptap';
      this.$nextTick(() => {
        document.querySelector('.dialog input').focus();
      });
    },

    handleFileClick(file) {
      if (file.isDirectory) {
        this.navigateTo(this.currentPath + '/' + file.name);
      } else if (this.isPreviewable(file.name)) {
        // Store info about file to be opened after download
        this.pendingFileToOpen = file.name;
        this.downloadFile(file.name);
      }
    },

    editDownloadedFile(file, index) {
      const fileName = file.fileName.toLowerCase();
      if (fileName.endsWith('.txt')) {
        this.openTextEditor(file, index);
      } else if (fileName.endsWith('.tiptap')) {
        this.openTiptapEditor(file, index);
      } else if (this.isPreviewable(fileName)) {
        // Check if it's an image file
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
        if (imageExtensions.some(ext => fileName.endsWith(ext))) {
          this.openImagePreview(file, index);
        }
      }
    },

    saveToDisk(file, index) {
      try {
        const blob = this.convertBase64ToBlob(file.body, file.contentType);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.fileName;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error saving file to disk:', error);
        this.errorMessages = [error.toString()];
      }
    },

    // Add new method to toggle dropdowns
    toggleDropdown(dropdownId) {
      // Close the currently open dropdown if there is one AND it's different from the one being toggled
      if (this.currentOpenDropdown && this.currentOpenDropdown !== dropdownId) {
        // Check if the previously open dropdown element still exists
        const previousDropdownElement = document.getElementById(this.currentOpenDropdown);
        if (previousDropdownElement) {
          previousDropdownElement.classList.remove('show');
        }
      }
      
      // Toggle the clicked dropdown
      const dropdown = document.getElementById(dropdownId);
      if (dropdown) {
        dropdown.classList.toggle('show');
        
        // Update the current open dropdown tracker
        if (dropdown.classList.contains('show')) {
          this.currentOpenDropdown = dropdownId;
        } else {
          // If we just closed the dropdown, reset the tracker
          this.currentOpenDropdown = null;
        }
      } else {
        // If the clicked dropdown doesn't exist (e.g., after deletion), ensure tracker is null
        this.currentOpenDropdown = null;
      }
    },
    
    // Add a method to close dropdowns when clicking elsewhere
    closeDropdowns(event) {
      const clickedInsideDropdownTrigger = event.target.matches('.action-icon, .add-btn');
      const clickedInsideDropdownContent = event.target.closest('.dropdown-content');

      // If the click was outside the trigger AND outside the content of the currently open dropdown
      if (!clickedInsideDropdownTrigger && !clickedInsideDropdownContent) {
        if (this.currentOpenDropdown) {
          const dropdownElement = document.getElementById(this.currentOpenDropdown);
          // Check if the element exists before trying to modify its classList
          if (dropdownElement) {
            dropdownElement.classList.remove('show');
          }
          // Reset the tracker regardless of whether the element was found,
          // as the click was outside the relevant areas.
          this.currentOpenDropdown = null;
        }
      }
    },
  }
}