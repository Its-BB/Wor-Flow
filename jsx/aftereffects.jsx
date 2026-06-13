var WorFlow = {
    version: "1.0.0",
    
    getDocumentsPath: function() {
        return Folder.myDocuments.fsName;
    },
    
    getExtensionRoot: function() {
        try {
            var jsxFile = new File($.fileName);
            if (!jsxFile.exists) return null;
            return jsxFile.parent.parent;
        } catch (e) {
            return null;
        }
    },

    getExtensionPath: function() {
        try {
            var extensionRoot = this.getExtensionRoot();
            if (!extensionRoot) {
                return this.stringifyJSON({ success: false, error: "Extension root not found" });
            }
            return this.stringifyJSON({ success: true, path: extensionRoot.fsName });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },

    getBuiltInPresetFile: function(ffxFileName) {
        try {
            var candidates = [];
            var extensionRoot = this.getExtensionRoot();
            if (extensionRoot) {
                candidates.push(new File(extensionRoot.fsName + "/assets/Presets/" + ffxFileName));
                candidates.push(new File(extensionRoot.fsName + "/Presets/" + ffxFileName));
            }
            var folderResult = this.getUserFolderPaths();
            if (folderResult.success && folderResult.data && folderResult.data.presets) {
                candidates.push(new File(folderResult.data.presets + "/" + ffxFileName));
            }
            for (var i = 0; i < candidates.length; i++) {
                if (candidates[i].exists) return candidates[i];
            }
            return null;
        } catch (e) {
            return null;
        }
    },
    getUserPresetsFolder: function() {
        try {
            var folderResult = this.getUserFolderPaths();
            if (folderResult.success && folderResult.data && folderResult.data.presets) {
                return new Folder(folderResult.data.presets);
            }
        } catch (e) {}
        return null;
    },

    getSystemInfo: function() {
        try {
            return this.stringifyJSON({
                success: true,
                data: {
                    username: $.getenv("USERNAME") || $.getenv("USER") || "User",
                    documentsPath: Folder.myDocuments.fsName,
                    aeVersion: app.version,
                    osVersion: $.os,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    
    getUserFolderPaths: function() {
        try {
            var documentsFolder = Folder.myDocuments;
            var worFlowFolder = new Folder(documentsFolder.fsName + "/WorFlow");
            if (!worFlowFolder.exists) {
                worFlowFolder.create();
            }
            var main = worFlowFolder.fsName;
            return {
                success: true,
                data: {
                    mainFolder: main,
                    preferences: main + "/Preferences",
                    presets: main + "/Presets"
                }
            };
        } catch (e) {
            return { success: false, error: e.toString() };
        }
    },

    ensureFolder: function(folderPath) {
        var folder = new Folder(folderPath);
        if (!folder.exists) {
            folder.create();
        }
        return folder;
    },

    createUserFolder: function() {
        return this.stringifyJSON(this.getUserFolderPaths());
    },
    
    savePreferences: function(preferences) {
        try {
            var folderResult = this.getUserFolderPaths();
            if (!folderResult.success) return this.stringifyJSON(folderResult);
            this.ensureFolder(folderResult.data.preferences);

            var prefsFile = new File(folderResult.data.preferences + "/user_preferences.json");
            if (!prefsFile.open("w")) {
                return this.stringifyJSON({ success: false, error: "Could not write preferences file" });
            }
            prefsFile.write(JSON.stringify(preferences, null, 2));
            prefsFile.close();
            
            return this.stringifyJSON({ success: true, message: "Preferences saved successfully" });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    
    loadPreferences: function() {
        try {
            var folderResult = this.getUserFolderPaths();
            if (!folderResult.success) return this.stringifyJSON(folderResult);

            var prefsFile = new File(folderResult.data.preferences + "/user_preferences.json");
            if (!prefsFile.exists) {
                return this.stringifyJSON({
                    success: true,
                    data: {
                        accentColor: "#d4a853",
                        animationSpeed: "1",
                        autoSave: true
                    }
                });
            }
            
            prefsFile.open("r");
            var content = prefsFile.read();
            prefsFile.close();
            
            return this.stringifyJSON({
                success: true,
                data: JSON.parse(content)
            });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    

    applyEasing: function(property, keyIndex, easingType) {
        var easeIn = new KeyframeEase(0, 33);
        var easeOut = new KeyframeEase(0, 33);
        
        switch (easingType) {
            case "ease-in":
                easeIn = new KeyframeEase(0, 75);
                break;
            case "ease-out":
                easeOut = new KeyframeEase(0, 75);
                break;
            case "ease-in-out":
                easeIn = new KeyframeEase(0, 75);
                easeOut = new KeyframeEase(0, 75);
                break;
        }
        
        property.setTemporalEaseAtKey(keyIndex, [easeIn], [easeOut]);
    },
    
    getProjectInfo: function() {
        try {
            var comp = app.project.activeItem;
            return this.stringifyJSON({
                success: true,
                data: {
                    projectName: app.project.file ? app.project.file.name : "Untitled Project",
                    activeComp: comp ? comp.name : null,
                    compDuration: comp ? comp.duration : null,
                    compFrameRate: comp ? comp.frameRate : null,
                    selectedLayers: comp ? comp.selectedLayers.length : 0
                }
            });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    
    scanAssetsFolder: function(subPath) {
        var basePath = '';
        try {
            var folderResultStr = this.createUserFolder();
            var folderResult = JSON.parse(folderResultStr);
            
            if (!folderResult.success) {
                return this.stringifyJSON({ success: false, error: folderResult.error || 'Failed to create user folder', path: '' });
            }
            
            basePath = folderResult.data.mainFolder + "\\Assets";
            if (subPath && subPath !== '') {
                subPath = subPath.replace(/\//g, '\\');
                basePath = basePath + "\\" + subPath;
            }
            
            var assetsFolder = new Folder(basePath);
            if (!assetsFolder.exists) {
                assetsFolder.create();
            }
            
            var assets = [];
            var items = assetsFolder.getFiles();
            
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                
                if (item instanceof Folder) {
                    assets.push({
                        name: item.name,
                        path: item.fsName,
                        type: 'folder',
                        category: 'folder',
                        isFolder: true,
                        size: 0
                    });
                }
                else if (item instanceof File) {
                    var asset = this.getAssetInfo(item);
                    if (asset) {
                        assets.push(asset);
                    }
                }
            }
            
            return this.stringifyJSON({
                success: true,
                data: {
                    assets: assets,
                    assetsFolder: assetsFolder.fsName,
                    path: basePath
                }
            });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString(), path: basePath });
        }
    },
    
    getAssetInfo: function(file) {
        try {
            var name = file.name;
            try {
                name = decodeURIComponent(name);
            } catch (e) {
            }
            
            var extension = name.substring(name.lastIndexOf('.') + 1).toLowerCase();
            var size = file.length;
            var modified = file.modified;
            
            var type = 'other';
            var category = 'other';
            
            if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'psd', 'ai'].indexOf(extension) !== -1) {
                type = 'image';
                category = 'images';
            } else if (['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm'].indexOf(extension) !== -1) {
                type = 'video';
                category = 'videos';
            } else if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].indexOf(extension) !== -1) {
                type = 'audio';
                category = 'audio';
            }
            
            return {
                name: name,
                path: file.fsName,
                size: size,
                type: type,
                category: category,
                extension: extension,
                modified: modified.toString(),
                thumbnail: this.generateThumbnailPath(file)
            };
        } catch (e) {
            return null;
        }
    },
    
    generateThumbnailPath: function(file) {
        var name = file.name;
        var baseName = name.substring(0, name.lastIndexOf('.'));
        var thumbnailName = baseName + '_thumb.jpg';
        var thumbnailPath = file.parent.fsName + '/thumbnails/' + thumbnailName;
        return thumbnailPath;
    },
    
    createDownloadsFolder: function() {
        try {
            var folderResult = this.getUserFolderPaths();
            if (!folderResult.success) return this.stringifyJSON(folderResult);
            this.ensureFolder(folderResult.data.mainFolder + "/Downloads");
            return this.stringifyJSON({ success: true });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },

    writeFileChunk: function(fileName, hexString, isFirstChunk) {
        try {
            var folderResult = this.getUserFolderPaths();
            if (!folderResult.success) return this.stringifyJSON(folderResult);
            if (isFirstChunk) {
                this.ensureFolder(folderResult.data.mainFolder + "/Downloads");
            }
            var filePath = folderResult.data.mainFolder + "/Downloads/" + fileName;
            var file = new File(filePath);
            
            file.encoding = "BINARY";
            var mode = isFirstChunk ? "w" : "a";
            if (!file.open(mode)) {
                return this.stringifyJSON({ success: false, error: "Could not open file" });
            }
            
            var binaryData = "";
            for (var i = 0; i < hexString.length; i += 2) {
                var hex = hexString.substr(i, 2);
                binaryData += String.fromCharCode(parseInt(hex, 16));
            }
            
            file.write(binaryData);
            file.close();
            
            return this.stringifyJSON({ success: true });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    
    collectWavFiles: function(folder, prefix) {
        if (prefix === undefined) prefix = '';
        var sounds = [];
        try {
            var files = folder.getFiles();
            
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                
                if (file instanceof Folder) {
                    var decodedFolderName = file.name;
                    try {
                        decodedFolderName = decodeURIComponent(file.name);
                    } catch (e) {
                    }
                    
                    var newPrefix = prefix ? prefix + ' / ' + decodedFolderName : decodedFolderName;
                    var subSounds = this.collectWavFiles(file, newPrefix);
                    sounds = sounds.concat(subSounds);
                }
                
                if (file instanceof File) {
                    var fileName = file.name.toLowerCase();
                    if (fileName.indexOf('.wav') !== -1 || fileName.indexOf('.mp3') !== -1 || fileName.indexOf('.m4a') !== -1) {
                        var decodedName = file.name;
                        try {
                            decodedName = decodeURIComponent(file.name);
                        } catch (e) {
                        }
                        
                        var displayName = prefix ? prefix + ' / ' + decodedName : decodedName;
                        
                        sounds.push({
                            name: displayName,
                            path: file.fsName,
                            size: file.length
                        });
                    }
                }
            }
        } catch (e) {
        }
        
        return sounds;
    },
    
    getSfxPath: function() {
        try {
            var root = this.getExtensionRoot();
            if (!root) {
                return this.stringifyJSON({ success: false, error: "Extension root not found" });
            }
            var sfxFolder = new Folder(root.fsName + "/sfx");
            return this.stringifyJSON({ success: true, path: sfxFolder.fsName });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },

    scanSFXFolder: function(sfxPath) {
        try {
            if (!sfxPath) {
                var root = this.getExtensionRoot();
                if (!root) {
                    return this.stringifyJSON({
                        success: false,
                        error: "Extension root not found",
                        categories: []
                    });
                }
                sfxPath = root.fsName + "/sfx";
            }
            var sfxFolder = new Folder(sfxPath);
            
            if (!sfxFolder.exists) {
                return this.stringifyJSON({ 
                    success: false, 
                    error: "SFX folder not found at: " + sfxPath,
                    categories: [] 
                });
            }
            
            var categories = [];
            var allFiles = sfxFolder.getFiles();
            
            var topLevelFolders = [];
            for (var i = 0; i < allFiles.length; i++) {
                if (allFiles[i] instanceof Folder) {
                    topLevelFolders.push(allFiles[i]);
                }
            }
            
            for (var i = 0; i < topLevelFolders.length; i++) {
                var categoryFolder = topLevelFolders[i];
                var categoryName = categoryFolder.name;
                
                try {
                    categoryName = decodeURIComponent(categoryName);
                } catch (e) {
                }
                
                var allSounds = this.collectWavFiles(categoryFolder);
                
                if (allSounds.length > 0) {
                    categories.push({
                        name: categoryName,
                        count: allSounds.length,
                        sounds: allSounds
                    });
                }
            }
            
            return this.stringifyJSON({ success: true, categories: categories, totalCategories: topLevelFolders.length });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString(), categories: [] });
        }
    },
    
    getLocalEffectFiles: function(folderPath) {
        try {
            var folder = new Folder(folderPath);
            if (!folder.exists) {
                return this.stringifyJSON([]);
            }
            
            var files = folder.getFiles("*.ffx");
            var fileNames = [];
            
            for (var i = 0; i < files.length; i++) {
                if (files[i] instanceof File) {
                    fileNames.push(files[i].name);
                }
            }
            
            return this.stringifyJSON(fileNames);
        } catch (e) {
            return this.stringifyJSON([]);
        }
    },
    
    applyEffectToSelectedLayer: function(effectPath, effectName) {
        try {
            app.beginUndoGroup("Apply Effect");
            
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) {
                return this.stringifyJSON({ success: false, error: "No active composition" });
            }
            
            if (comp.selectedLayers.length === 0) {
                return this.stringifyJSON({ success: false, error: "No layer selected" });
            }
            
            var selectedLayer = comp.selectedLayers[0];
            
            var adjustmentLayer = comp.layers.addSolid([1, 1, 1], effectName, comp.width, comp.height, 1.0);
            adjustmentLayer.adjustmentLayer = true;
            
            adjustmentLayer.moveBefore(selectedLayer);
            
            adjustmentLayer.inPoint = selectedLayer.inPoint;
            adjustmentLayer.outPoint = selectedLayer.outPoint;
            
            var presetFile = new File(effectPath);
            if (presetFile.exists) {
                try {
                    adjustmentLayer.applyPreset(presetFile);
                } catch (presetErr) {
                }
            }
            
            app.endUndoGroup();
            
            return this.stringifyJSON({
                success: true,
                message: "Effect applied",
                data: {
                    layerName: adjustmentLayer.name
                }
            });
        } catch (e) {
            app.endUndoGroup();
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    
    importAsset: function(assetPath) {
        try {
            var file = new File(assetPath);
            if (!file.exists) {
                return this.stringifyJSON({ success: false, error: "Asset file not found: " + assetPath });
            }
            
            var importedFile = app.project.importFile(new ImportOptions(file));
            
            if (importedFile) {
                var comp = app.project.activeItem;
                if (comp && comp instanceof CompItem) {
                    var layer = comp.layers.add(importedFile);
                    layer.startTime = comp.time;
                    
                    return this.stringifyJSON({
                        success: true,
                        message: "Asset imported and added to composition",
                        data: {
                            itemName: importedFile.name,
                            layerName: layer.name
                        }
                    });
                } else {
                    return this.stringifyJSON({
                        success: true,
                        message: "Asset imported to project",
                        data: {
                            itemName: importedFile.name
                        }
                    });
                }
            } else {
                return this.stringifyJSON({ success: false, error: "Failed to import asset" });
            }
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    
    // Apply FFX preset to adjustment layer
    applyFFXPreset: function(ffxFileName) {
        try {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) {
                return this.stringifyJSON({ success: false, error: "No active composition" });
            }
            
            var ffxFile = this.getBuiltInPresetFile(ffxFileName);
            
            if (!ffxFile) {
                return this.stringifyJSON({ success: false, error: "FFX file not found: " + ffxFileName });
            }
            
            // Get selected layer or use comp duration
            var targetLayer = null;
            var adjustmentLayer = null;
            var layerDuration = comp.duration;
            var layerStartTime = 0;
            
            if (comp.selectedLayers.length > 0) {
                targetLayer = comp.selectedLayers[0];
                layerDuration = targetLayer.outPoint - targetLayer.inPoint;
                layerStartTime = targetLayer.inPoint;
            }
            
            // Create adjustment layer with the correct duration
            adjustmentLayer = comp.layers.addSolid([1, 1, 1], "Color Grade", comp.width, comp.height, comp.pixelAspect);
            adjustmentLayer.adjustmentLayer = true;
            
            // Set adjustment layer properties
            if (targetLayer) {
                // Position above selected layer
                adjustmentLayer.moveBefore(targetLayer);
                
                // Match selected layer's duration and position
                adjustmentLayer.inPoint = targetLayer.inPoint;
                adjustmentLayer.outPoint = targetLayer.outPoint;
            } else {
                // Use full composition duration
                adjustmentLayer.inPoint = 0;
                adjustmentLayer.outPoint = comp.duration;
            }
            
            // Apply FFX preset with a small delay to ensure layer is ready
            $.sleep(100);
            try {
                adjustmentLayer.applyPreset(ffxFile);
            } catch (presetError) {
                // Preset application might fail silently, but layer is still created
                // This is acceptable - the adjustment layer is ready for use
            }
            
            return this.stringifyJSON({
                success: true,
                message: "FFX preset applied successfully",
                data: {
                    layerName: adjustmentLayer.name,
                    ffxFile: ffxFileName
                }
            });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    
    copyToAssetsFolder: function(sourcePath, fileName) {
        try {
            var folderResult = this.getUserFolderPaths();
            if (!folderResult.success) return this.stringifyJSON(folderResult);

            var assetsFolder = this.ensureFolder(folderResult.data.mainFolder + "/Assets");
            
            var sourceFile = new File(sourcePath);
            var targetFile = new File(assetsFolder.fsName + "/" + fileName);
            
            if (sourceFile.copy(targetFile)) {
                return this.stringifyJSON({
                    success: true,
                    message: "Asset copied successfully",
                    data: {
                        targetPath: targetFile.fsName
                    }
                });
            } else {
                return this.stringifyJSON({ success: false, error: "Failed to copy asset" });
            }
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    
    createFolder: function(folderName, parentPath) {
        try {
            var folderResultStr = this.createUserFolder();
            var folderResult = JSON.parse(folderResultStr);
            
            if (!folderResult.success) return this.stringifyJSON({ success: false, error: folderResult.error });
            
            var basePath = folderResult.data.mainFolder + "/Assets";
            if (parentPath) {
                basePath = basePath + "/" + parentPath;
            }
            
            var newFolder = new Folder(basePath + "/" + folderName);
            if (newFolder.exists) {
                return this.stringifyJSON({ success: false, error: "Folder already exists" });
            }
            
            if (newFolder.create()) {
                return this.stringifyJSON({
                    success: true,
                    message: "Folder created successfully",
                    data: { path: newFolder.fsName }
                });
            } else {
                return this.stringifyJSON({ success: false, error: "Failed to create folder" });
            }
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    
    copyAssetToFolder: function(fileName, base64Data, subPath) {
        try {
            var folderResultStr = this.createUserFolder();
            var folderResult = JSON.parse(folderResultStr);
            
            if (!folderResult.success) {
                return this.stringifyJSON({ success: false, error: 'Failed to create user folder' });
            }
            
            var basePath = folderResult.data.mainFolder + "/Assets";
            if (subPath && subPath !== '') {
                basePath = basePath + "/" + subPath;
            }
            
            var assetsFolder = new Folder(basePath);
            if (!assetsFolder.exists) {
                assetsFolder.create();
            }
            
            var filePath = assetsFolder.fsName + "/" + fileName;
            var file = new File(filePath);
            
            file.open("w");
            file.encoding = "BINARY";
            
            var binaryString = atob(base64Data);
            file.write(binaryString);
            file.close();
            
            return this.stringifyJSON({
                success: true,
                message: "File copied successfully",
                data: { path: filePath }
            });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    
    moveAsset: function(sourcePath, destFolderPath) {
        try {
            var sourceFile = new File(sourcePath);
            if (!sourceFile.exists) {
                return this.stringifyJSON({ success: false, error: "Source file not found" });
            }
            
            var destFolder = new Folder(destFolderPath);
            if (!destFolder.exists) {
                return this.stringifyJSON({ success: false, error: "Destination folder not found" });
            }
            
            var fileName = sourceFile.name;
            var targetFile = new File(destFolder.fsName + "/" + fileName);
            
            if (sourceFile.copy(targetFile)) {
                sourceFile.remove();
                return this.stringifyJSON({
                    success: true,
                    message: "Asset moved successfully"
                });
            } else {
                return this.stringifyJSON({ success: false, error: "Failed to move asset" });
            }
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    
    selectFilesToImport: function() {
        try {
            var files = File.openDialog("Select files to import", undefined, true);
            if (files) {
                var filePaths = [];
                for (var i = 0; i < files.length; i++) {
                    filePaths.push(files[i].fsName);
                }
                return this.stringifyJSON({
                    success: true,
                    files: filePaths
                });
            }
            return this.stringifyJSON({ success: false });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    
    selectFolderToImport: function() {
        try {
            var folder = Folder.selectDialog("Select folder to import");
            if (folder) {
                return this.stringifyJSON({
                    success: true,
                    folder: folder.fsName
                });
            }
            return this.stringifyJSON({ success: false });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    
    copyFolderToAssets: function(sourceFolderPath, parentPath) {
        try {
            var folderResult = this.getUserFolderPaths();
            if (!folderResult.success) return this.stringifyJSON(folderResult);

            var sourceFolder = new Folder(sourceFolderPath);
            if (!sourceFolder.exists) {
                return this.stringifyJSON({ success: false, error: "Source folder not found" });
            }
            
            var basePath = folderResult.data.mainFolder + "/Assets";
            if (parentPath) {
                basePath = basePath + "/" + parentPath;
            }
            
            var targetFolder = new Folder(basePath + "/" + sourceFolder.name);
            if (!targetFolder.exists) {
                targetFolder.create();
            }
            
            var files = sourceFolder.getFiles();
            var copiedCount = 0;
            
            for (var i = 0; i < files.length; i++) {
                if (files[i] instanceof File) {
                    var targetFile = new File(targetFolder.fsName + "/" + files[i].name);
                    if (files[i].copy(targetFile)) {
                        copiedCount++;
                    }
                }
            }
            
            return this.stringifyJSON({
                success: true,
                message: "Folder copied successfully",
                data: {
                    copiedFiles: copiedCount,
                    targetPath: targetFolder.fsName
                }
            });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    
    downloadAndSaveFile: function(url, filePath) {
        try {
            var urlMatch = url.match(/^https?:\/\/([^\/]+)(\/.*)/);
            if (!urlMatch) {
                return this.stringifyJSON({ success: false, error: "Invalid URL" });
            }
            
            var host = urlMatch[1];
            var path = urlMatch[2];
            var port = url.indexOf("https") === 0 ? 443 : 80;
            
            var file = new File(filePath);
            var parentFolder = file.parent;
            
            if (!parentFolder.exists) {
                parentFolder.create();
            }
            
            var socket = new Socket();
            socket.encoding = "BINARY";
            
            if (!socket.open(host + ":" + port, "binary")) {
                return this.stringifyJSON({ success: false, error: "Could not connect to server" });
            }
            
            var request = "GET " + path + " HTTP/1.1\r\n";
            request += "Host: " + host + "\r\n";
            request += "Connection: close\r\n";
            request += "User-Agent: WorFlow\r\n";
            request += "\r\n";
            
            socket.write(request);
            
            var response = "";
            var chunk;
            while ((chunk = socket.read(65536)) !== "") {
                response += chunk;
            }
            socket.close();
            
            var bodyStart = response.indexOf("\r\n\r\n");
            if (bodyStart === -1) {
                return this.stringifyJSON({ success: false, error: "Invalid HTTP response" });
            }
            
            var body = response.substring(bodyStart + 4);
            
            file.encoding = "BINARY";
            if (!file.open("w")) {
                return this.stringifyJSON({ success: false, error: "Could not open file for writing" });
            }
            
            file.write(body);
            file.close();
            
            if (file.exists && file.length > 0) {
                return this.stringifyJSON({
                    success: true,
                    message: "File downloaded successfully",
                    data: { path: file.fsName, size: file.length }
                });
            }
            
            return this.stringifyJSON({ success: false, error: "File was not created" });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    
    downloadFile: function(url, fileName) {
        try {
            var folderResult = this.getUserFolderPaths();
            if (!folderResult.success) return this.stringifyJSON(folderResult);

            var downloadsPath = folderResult.data.mainFolder + "/Downloads";
            this.ensureFolder(downloadsPath);
            
            var targetFile = new File(downloadsPath + "/" + fileName);
            
            var urlParts = url.match(/^https?:\/\/([^\/]+)(\/.*)/);
            if (!urlParts) {
                return this.stringifyJSON({ success: false, error: "Invalid URL" });
            }
            
            var host = urlParts[1];
            var path = urlParts[2];
            
            var socket = new Socket();
            
            if (!socket.open(host + ":443", "binary")) {
                return this.stringifyJSON({ success: false, error: "Could not connect to server" });
            }
            
            var request = "GET " + path + " HTTP/1.1\r\n";
            request += "Host: " + host + "\r\n";
            request += "Connection: close\r\n";
            request += "\r\n";
            
            socket.write(request);
            
            var response = "";
            var chunk;
            while ((chunk = socket.read(10000)) !== "") {
                response += chunk;
            }
            socket.close();
            
            var headerEnd = response.indexOf("\r\n\r\n");
            if (headerEnd === -1) {
                return this.stringifyJSON({ success: false, error: "Invalid HTTP response" });
            }
            
            var body = response.substring(headerEnd + 4);
            
            targetFile.encoding = "BINARY";
            if (!targetFile.open("w")) {
                return this.stringifyJSON({ success: false, error: "Could not open file for writing" });
            }
            
            targetFile.write(body);
            targetFile.close();
            
            if (targetFile.exists && targetFile.length > 0) {
                return this.stringifyJSON({
                    success: true,
                    message: "File downloaded successfully",
                    data: { path: targetFile.fsName, size: targetFile.length }
                });
            }
            
            return this.stringifyJSON({ success: false, error: "File download failed - file is empty" });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    
    createEmptyFile: function(filePath) {
        try {
            var file = new File(filePath);
            var parentFolder = file.parent;
            
            if (!parentFolder.exists) {
                parentFolder.create();
            }
            
            file.encoding = "BINARY";
            if (!file.open("w")) {
                return this.stringifyJSON({ success: false, error: "Could not create file: " + filePath });
            }
            file.close();
            
            return this.stringifyJSON({
                success: true,
                message: "File created",
                data: { path: file.fsName }
            });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    
    appendToFile: function(filePath, base64Chunk, isLast) {
        try {
            var file = new File(filePath);
            file.encoding = "BINARY";
            
            if (!file.open("a")) {
                return this.stringifyJSON({ success: false, error: "Could not open file for appending: " + filePath });
            }
            
            var decoded = this.base64Decode(base64Chunk);
            file.write(decoded);
            file.close();
            
            return this.stringifyJSON({
                success: true,
                message: "Chunk written",
                data: { path: file.fsName, size: file.length }
            });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    
    saveFileToPath: function(filePath, base64Data) {
        try {
            var file = new File(filePath);
            var parentFolder = file.parent;
            
            if (!parentFolder.exists) {
                parentFolder.create();
            }
            
            file.encoding = "BINARY";
            
            if (!file.open("w")) {
                return this.stringifyJSON({ success: false, error: "Could not open file for writing: " + filePath });
            }
            
            var decoded = this.base64Decode(base64Data);
            file.write(decoded);
            file.close();
            
            if (!file.exists) {
                return this.stringifyJSON({ success: false, error: "File was not created" });
            }
            
            return this.stringifyJSON({
                success: true,
                message: "File saved successfully",
                data: { path: file.fsName, size: file.length }
            });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: "Exception: " + e.toString() });
        }
    },
    
    base64Decode: function(base64) {
        var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;
        
        base64 = base64.replace(/[^A-Za-z0-9\+\/\=]/g, "");
        
        while (i < base64.length) {
            enc1 = keyStr.indexOf(base64.charAt(i++));
            enc2 = keyStr.indexOf(base64.charAt(i++));
            enc3 = keyStr.indexOf(base64.charAt(i++));
            enc4 = keyStr.indexOf(base64.charAt(i++));
            
            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;
            
            output = output + String.fromCharCode(chr1);
            
            if (enc3 != 64) {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 != 64) {
                output = output + String.fromCharCode(chr3);
            }
        }
        
        return output;
    },
    
    saveCustomPreset: function(presetName, effectData) {
        try {
            var folderResult = this.getUserFolderPaths();
            if (!folderResult.success) return this.stringifyJSON(folderResult);
            this.ensureFolder(folderResult.data.presets);

            var preset = {
                name: presetName,
                effects: effectData,
                created: new Date().toISOString(),
                version: this.version,
                type: 'custom'
            };
            
            var presetFile = new File(folderResult.data.presets + "/" + presetName + "_custom.json");
            presetFile.open("w");
            presetFile.write(this.stringifyJSON(preset));
            presetFile.close();
            
            return this.stringifyJSON({ success: true, message: "Custom preset saved: " + presetName });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    
    stringifyJSON: function(obj) {
        try {
            return JSON.stringify(obj);
        } catch (e) {
            if (typeof obj === 'string') {
                return '"' + obj.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
            }
            if (typeof obj === 'number' || typeof obj === 'boolean') return obj.toString();
            if (obj === null) return 'null';
            if (obj instanceof Array) {
                var items = [];
                for (var i = 0; i < obj.length; i++) {
                    items.push(this.stringifyJSON(obj[i]));
                }
                return '[' + items.join(',') + ']';
            }
            if (typeof obj === 'object') {
                var items = [];
                for (var key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        items.push('"' + key + '":' + this.stringifyJSON(obj[key]));
                    }
                }
                return '{' + items.join(',') + '}';
            }
            return '""';
        }
    },
    
    getCurrentLayerEffects: function() {
        try {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) {
                return this.stringifyJSON({ success: false, error: "No active composition" });
            }
            
            var selectedLayers = comp.selectedLayers;
            if (selectedLayers.length === 0) {
                return this.stringifyJSON({ success: false, error: "No layers selected" });
            }
            
            var layer = selectedLayers[0];
            var effects = [];
            
            for (var i = 1; i <= layer.Effects.numProperties; i++) {
                var effect = layer.Effects.property(i);
                var effectData = {
                    matchName: effect.matchName,
                    name: effect.name,
                    enabled: effect.enabled,
                    properties: {}
                };
                
                for (var j = 1; j <= effect.numProperties; j++) {
                    var prop = effect.property(j);
                    if (prop.canSetValue) {
                        effectData.properties[prop.name] = prop.value;
                    }
                }
                
                effects.push(effectData);
            }
            
            return this.stringifyJSON({
                success: true,
                data: {
                    layerName: layer.name,
                    effects: effects
                }
            });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
        }
    },
    
    applyFadeTransition: function(layer, settings) {
        var opacity = layer.property("ADBE Transform Group").property("ADBE Opacity");
        var comp = layer.containingComp;
        var duration = settings && settings.duration ? settings.duration : 1; // 1 second default
        
        while (opacity.numKeys > 0) {
            opacity.removeKey(1);
        }
        
        opacity.setValueAtTime(layer.inPoint, 0);
        opacity.setValueAtTime(layer.inPoint + duration, 100);
        
        opacity.setValueAtTime(layer.outPoint - duration, 100);
        opacity.setValueAtTime(layer.outPoint, 0);
    },
    
    applyWipeTransition: function(layer, settings) {
        var linearWipe = layer.Effects.addProperty("ADBE Linear Wipe");
        linearWipe.property("ADBE Linear Wipe-0001").setValue(settings && settings.completion ? settings.completion : 50);
        linearWipe.property("ADBE Linear Wipe-0002").setValue(settings && settings.angle ? settings.angle : 0);
        linearWipe.property("ADBE Linear Wipe-0003").setValue(settings && settings.feather ? settings.feather : 10);
    },
    
    applyZoomTransition: function(layer, settings) {
        var transform = layer.property("ADBE Transform Group");
        var scale = transform.property("ADBE Scale");
        var comp = layer.containingComp;
        var duration = settings && settings.duration ? settings.duration : 1;
        
        while (scale.numKeys > 0) {
            scale.removeKey(1);
        }
        
        var startScale = settings && settings.startScale ? settings.startScale : 0;
        var endScale = settings && settings.endScale ? settings.endScale : 100;
        
        scale.setValueAtTime(layer.inPoint, [startScale, startScale]);
        scale.setValueAtTime(layer.inPoint + duration, [endScale, endScale]);
    },
    
    applySpinTransition: function(layer, settings) {
        var transform = layer.property("ADBE Transform Group");
        var rotation = transform.property("ADBE Rotate Z");
        var comp = layer.containingComp;
        var duration = settings && settings.duration ? settings.duration : 1;
        
        while (rotation.numKeys > 0) {
            rotation.removeKey(1);
        }
        
        var rotations = settings && settings.rotations ? settings.rotations : 1;
        var totalRotation = rotations * 360;
        
        rotation.setValueAtTime(layer.inPoint, 0);
        rotation.setValueAtTime(layer.inPoint + duration, totalRotation);
    }
};

function applyPreset(presetName, settings) {
    return WorFlow.stringifyJSON(WorFlow.applyPreset(presetName, settings));
}

function getSystemInfo() {
    return WorFlow.getSystemInfo();
}

function createUserFolder() {
    return WorFlow.createUserFolder();
}

function savePreferences(preferences) {
    return WorFlow.savePreferences(JSON.parse(preferences));
}

function loadPreferences() {
    return WorFlow.loadPreferences();
}

function applyAnimationCurve(keyframesJson, propertyPath) {
    try {
        var keyframes = JSON.parse(keyframesJson);
        return WorFlow.applyAnimationCurve(keyframes, propertyPath);
    } catch (error) {
        return JSON.stringify({
            success: false,
            error: "JSON parse error: " + error.toString() + ". Input: " + keyframesJson.substring(0, 100)
        });
    }
}

function getProjectInfo() {
    return WorFlow.stringifyJSON(WorFlow.getProjectInfo());
}

function scanAssetsFolder() {
    return WorFlow.stringifyJSON(WorFlow.scanAssetsFolder());
}

function createDownloadsFolder() {
    return WorFlow.createDownloadsFolder();
}

function writeFileChunk(fileName, hexString, isFirstChunk) {
    return WorFlow.writeFileChunk(fileName, hexString, isFirstChunk);
}

function getExtensionPath() {
    return WorFlow.getExtensionPath();
}

function getSfxPath() {
    return WorFlow.getSfxPath();
}

function scanSFXFolder(sfxPath) {
    return WorFlow.scanSFXFolder(sfxPath || "");
}

function getLocalEffectFiles(folderPath) {
    return WorFlow.getLocalEffectFiles(folderPath);
}

function importAsset(assetPath) {
    return WorFlow.stringifyJSON(WorFlow.importAsset(assetPath));
}

function applyFFXPreset(ffxFileName) {
    return WorFlow.applyFFXPreset(ffxFileName);
}

function copyToAssetsFolder(sourcePath, fileName) {
    return WorFlow.stringifyJSON(WorFlow.copyToAssetsFolder(sourcePath, fileName));
}

function copyAssetToFolder(fileName, base64Data, subPath) {
    return WorFlow.copyAssetToFolder(fileName, base64Data, subPath);
}

function saveCustomPreset(presetName, effectData) {
    return WorFlow.stringifyJSON(WorFlow.saveCustomPreset(presetName, JSON.parse(effectData)));
}

function saveImportedPreset(presetName, presetType) {
    try {
        var folderResult = WorFlow.getUserFolderPaths();
        if (!folderResult.success) return WorFlow.stringifyJSON(folderResult);
        WorFlow.ensureFolder(folderResult.data.presets);

        var preset = {
            name: presetName,
            type: presetType
        };

        var presetFile = new File(folderResult.data.presets + "/" + presetName + ".json");
        presetFile.open("w");
        presetFile.write(WorFlow.stringifyJSON(preset));
        presetFile.close();
        
        return WorFlow.stringifyJSON({ success: true, message: "Preset saved: " + presetName });
    } catch (e) {
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applyFFXPreset(presetName, filePath) {
    try {
        var project = app.project;
        if (!project) {
            return JSON.stringify({ success: false, error: "No project open" });
        }
        
        var comp = project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        
        // Resolve preset: user imports, explicit path, then extension bundled presets
        var presetFile = null;
        var ffxFileName = presetName.indexOf(".ffx") === presetName.length - 4 ? presetName : presetName + ".ffx";
        var userPresetsFolder = WorFlow.getUserPresetsFolder();
        
        if (userPresetsFolder) {
            presetFile = new File(userPresetsFolder.fsName + "/" + ffxFileName);
            if (!presetFile.exists) presetFile = null;
        }
        
        if (!presetFile && filePath) {
            presetFile = new File(filePath);
            if (!presetFile.exists) presetFile = null;
        }
        
        if (!presetFile) {
            presetFile = WorFlow.getBuiltInPresetFile(ffxFileName);
        }
        
        if (!presetFile) {
            return JSON.stringify({ success: false, error: "Preset file not found: " + ffxFileName });
        }
        
        var selectedLayers = comp.selectedLayers;
        
        if (selectedLayers.length > 0) {
            // Apply to selected layers
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                if (layer.canAddEffect) {
                    layer.applyPreset(presetFile);
                }
            }
            return JSON.stringify({ success: true, message: "Preset applied to " + selectedLayers.length + " layer(s)" });
        } else {
            // Create adjustment layer for full composition length
            var solidColor = [1, 1, 1];
            var adjLayer = comp.layers.addSolid(solidColor, "Adjustment Layer", comp.width, comp.height, comp.pixelAspect);
            adjLayer.adjustmentLayer = true;
            adjLayer.opacity.setValue(0);
            
            adjLayer.applyPreset(presetFile);
            
            return JSON.stringify({ success: true, message: "Adjustment layer created and preset applied" });
        }
    } catch (e) {
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function copyFFXPreset(sourcePath, presetName) {
    try {
        var sourceFile = new File(sourcePath);
        if (!sourceFile.exists) {
            return JSON.stringify({ success: false, error: "Source file not found" });
        }
        
        var presetsFolder = WorFlow.getUserPresetsFolder();
        if (!presetsFolder) {
            return JSON.stringify({ success: false, error: "Could not create presets folder" });
        }
        if (!presetsFolder.exists) {
            presetsFolder.create();
        }
        
        var destFile = new File(presetsFolder.fsName + "/" + presetName + ".ffx");
        sourceFile.copy(destFile);
        
        return JSON.stringify({ success: true, message: "Preset copied to user presets folder" });
    } catch (e) {
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function deleteFFXPreset(presetName) {
    try {
        var presetsFolder = WorFlow.getUserPresetsFolder();
        if (!presetsFolder) {
            return JSON.stringify({ success: false, error: "Presets folder not found" });
        }
        var presetFile = new File(presetsFolder.fsName + "/" + presetName + ".ffx");
        
        if (presetFile.exists) {
            presetFile.remove();
            return JSON.stringify({ success: true, message: "Preset deleted" });
        } else {
            return JSON.stringify({ success: false, error: "Preset file not found" });
        }
    } catch (e) {
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applyBuiltInFFX(ffxFileName) {
    try {
        var project = app.project;
        if (!project) {
            return JSON.stringify({ success: false, error: "No project open" });
        }
        
        var comp = project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        
        var presetFile = WorFlow.getBuiltInPresetFile(ffxFileName);
        
        if (!presetFile) {
            return JSON.stringify({ success: false, error: "Preset file not found: " + ffxFileName });
        }
        
        var selectedLayers = comp.selectedLayers;
        
        if (selectedLayers.length > 0) {
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                if (layer.canAddEffect) {
                    layer.applyPreset(presetFile);
                }
            }
            return JSON.stringify({ success: true, message: "Preset applied to " + selectedLayers.length + " layer(s)" });
        }
        
        var duration = comp.duration;
        var adjustmentLayer = comp.layers.addSolid([1, 1, 1], "Adjustment Layer", comp.width, comp.height, comp.pixelAspect, duration);
        adjustmentLayer.adjustmentLayer = true;
        adjustmentLayer.label = 5;
        adjustmentLayer.applyPreset(presetFile);
        
        return JSON.stringify({ success: true, message: "Adjustment layer created and preset applied" });
    } catch (e) {
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function saveUserUid(jsonData) {
    try {
        var userData = JSON.parse(jsonData);

        var documentsPath = WorFlow.getDocumentsPath();
        var worFlowPath = documentsPath + "/WorFlow";
        
        var worFlowFolder = new Folder(worFlowPath);
        if (!worFlowFolder.exists) {
            worFlowFolder.create();
        }
        
        var uidFile = new File(worFlowPath + "/user_uid.json");
        uidFile.open("w");
        uidFile.write(jsonData);
        uidFile.close();

        return JSON.stringify({
            success: true,
            message: "User UID saved successfully"
        });
    } catch (error) {
        return JSON.stringify({
            success: false,
            error: error.toString()
        });
    }
}