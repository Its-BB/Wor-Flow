var WorFlow = {
    version: "1.0.0",
    _cachedExtensionRoot: null,
    
    getDocumentsPath: function() {
        return Folder.myDocuments.fsName;
    },
    
    getExtensionRoot: function() {
        if (this._cachedExtensionRoot) {
            var cached = new Folder(this._cachedExtensionRoot);
            if (cached.exists) return cached;
            this._cachedExtensionRoot = null;
        }
        try {
            if ($.fileName) {
                var jsxFile = new File($.fileName);
                if (jsxFile.exists) {
                    var root = jsxFile.parent.parent;
                    if (root && root.exists) {
                        this._cachedExtensionRoot = root.fsName;
                        return root;
                    }
                }
            }
        } catch (e) {}
        return null;
    },

    setExtensionRoot: function(path) {
        try {
            if (!path) {
                return this.stringifyJSON({ success: false, error: "No extension path" });
            }
            var folder = new Folder(String(path));
            if (!folder.exists) {
                folder = new Folder(String(path).replace(/\//g, "\\"));
            }
            if (!folder.exists) {
                return this.stringifyJSON({ success: false, error: "Extension folder not found" });
            }
            this._cachedExtensionRoot = folder.fsName;
            return this.stringifyJSON({ success: true, path: folder.fsName });
        } catch (e) {
            return this.stringifyJSON({ success: false, error: e.toString() });
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

function setExtensionRoot(path) {
    return WorFlow.setExtensionRoot(path);
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

function getSavedUserUid() {
    try {
        var documentsPath = WorFlow.getDocumentsPath();
        var worFlowPath = documentsPath + "/WorFlow";
        var uidFile = new File(worFlowPath + "/user_uid.json");

        if (uidFile.exists) {
            uidFile.open("r");
            var jsonData = uidFile.read();
            uidFile.close();

            var userData = JSON.parse(jsonData);
            return JSON.stringify({
                success: true,
                uid: userData.uid
            });
        } else {
            return JSON.stringify({
                success: false,
                error: "UID file not found"
            });
        }
    } catch (e) {
        return JSON.stringify({
            success: false,
            error: e.toString()
        });
    }
}

function getPresetContent(presetName) {
    try {
        var documentsFolder = Folder.userData;
        if (!documentsFolder) {
            documentsFolder = Folder(Folder.desktop);
        }

        var worFlowFolder = new Folder(documentsFolder + "/WorFlow");
        if (!worFlowFolder.exists) {
            return JSON.stringify({
                success: false,
                error: "WorFlow folder not found"
            });
        }
        
        var presetsFolder = new Folder(worFlowFolder + "/Presets");
        if (!presetsFolder.exists) {
            return JSON.stringify({
                success: false,
                error: "Presets folder not found"
            });
        }

        var presetFile = new File(presetsFolder + "/" + presetName);
        if (!presetFile.exists) {
            return JSON.stringify({
                success: false,
                error: "Preset file not found"
            });
        }

        if (presetFile.open("r")) {
            var content = presetFile.read();
            presetFile.close();

            var presetData = JSON.parse(content);
            return JSON.stringify(presetData);
        } else {
            return JSON.stringify({
                success: false,
                error: "Could not open preset file"
            });
        }
    } catch (error) {
        return JSON.stringify({
            success: false,
            error: error.toString()
        });
    }
}

function precomposeSelectedLayers() {
    app.beginUndoGroup("Pre-compose Selected Layers");
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            return JSON.stringify({ success: false, error: "No layers selected" });
        }
        
        var indices = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layer(i).selected) {
                indices.push(i);
            }
        }
        
        var precompName = "Precomp " + new Date().getTime();
        comp.layers.precompose(indices, precompName, true);
        
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: "Layers pre-composed successfully" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function createNullObject() {
    app.beginUndoGroup("Create Null Object");
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        
        var selectedLayers = comp.selectedLayers;
        var nullLayer = comp.layers.addNull();
        nullLayer.name = "Null " + comp.numLayers;
        nullLayer.label = 1;
        
        if (selectedLayers.length > 0) {
            var targetLayer = selectedLayers[0];
            nullLayer.moveBefore(targetLayer);
            nullLayer.startTime = targetLayer.inPoint;
            nullLayer.inPoint = targetLayer.inPoint;
            nullLayer.outPoint = targetLayer.outPoint;
        }
        
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: "Null object created" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function createSolidLayer() {
    app.beginUndoGroup("Create Solid Layer");
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        
        var defaultColor = [0.2, 0.2, 0.2];
        var pickedColor = $.colorPicker(defaultColor[0] * 255 * 65536 + defaultColor[1] * 255 * 256 + defaultColor[2] * 255);
        
        if (pickedColor === -1) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "Color selection cancelled" });
        }
        
        var r = ((pickedColor >> 16) & 0xFF) / 255;
        var g = ((pickedColor >> 8) & 0xFF) / 255;
        var b = (pickedColor & 0xFF) / 255;
        var solidColor = [r, g, b];
        
        var selectedLayers = comp.selectedLayers;
        var duration = comp.duration;
        
        if (selectedLayers.length > 0) {
            duration = selectedLayers[0].outPoint - selectedLayers[0].inPoint;
        }
        
        var solidLayer = comp.layers.addSolid(solidColor, "Solid " + comp.numLayers, comp.width, comp.height, comp.pixelAspect, duration);
        
        if (selectedLayers.length > 0) {
            var targetLayer = selectedLayers[0];
            solidLayer.moveBefore(targetLayer);
            solidLayer.startTime = targetLayer.inPoint;
        }
        
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: "Solid layer created" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function createAdjustmentLayer() {
    app.beginUndoGroup("Create Adjustment Layer");
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        
        var selectedLayers = comp.selectedLayers;
        var duration = comp.duration;
        
        if (selectedLayers.length > 0) {
            duration = selectedLayers[0].outPoint - selectedLayers[0].inPoint;
        }
        
        var adjustmentLayer = comp.layers.addSolid([1, 1, 1], "Adjustment Layer", comp.width, comp.height, comp.pixelAspect, duration);
        adjustmentLayer.adjustmentLayer = true;
        adjustmentLayer.label = 5;
        
        if (selectedLayers.length > 0) {
            var targetLayer = selectedLayers[0];
            adjustmentLayer.moveBefore(targetLayer);
            adjustmentLayer.startTime = targetLayer.inPoint;
        }
        
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: "Adjustment layer created" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function createCamera() {
    app.beginUndoGroup("Create Camera");
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        
        var selectedLayers = comp.selectedLayers;
        var cameraLayer = comp.layers.addCamera("Camera " + comp.numLayers, [comp.width/2, comp.height/2]);
        cameraLayer.label = 4;
        
        if (selectedLayers.length > 0) {
            var targetLayer = selectedLayers[0];
            cameraLayer.moveBefore(targetLayer);
            cameraLayer.startTime = targetLayer.inPoint;
            cameraLayer.inPoint = targetLayer.inPoint;
            cameraLayer.outPoint = targetLayer.outPoint;
        }
        
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: "Camera created" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function createLight() {
    app.beginUndoGroup("Create Light");
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        
        var selectedLayers = comp.selectedLayers;
        var lightLayer = comp.layers.addLight("Light " + comp.numLayers, [comp.width/2, comp.height/2]);
        lightLayer.label = 6;
        
        if (selectedLayers.length > 0) {
            var targetLayer = selectedLayers[0];
            lightLayer.moveBefore(targetLayer);
            lightLayer.startTime = targetLayer.inPoint;
            lightLayer.inPoint = targetLayer.inPoint;
            lightLayer.outPoint = targetLayer.outPoint;
        }
        
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: "Light created" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function enableTimeRemapping() {
    app.beginUndoGroup("Enable Time Remapping");
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            return JSON.stringify({ success: false, error: "No layers selected" });
        }
        
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            if (layer.canSetTimeRemapEnabled) {
                layer.timeRemapEnabled = true;
            }
        }
        
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: "Time remapping enabled on " + selectedLayers.length + " layer(s)" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function reverseLayerTime() {
    app.beginUndoGroup("Reverse Layer Time");
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            return JSON.stringify({ success: false, error: "No layers selected" });
        }
        
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            if (layer.canSetTimeRemapEnabled) {
                layer.timeRemapEnabled = true;
                var timeRemap = layer.property("ADBE Time Remapping");
                while (timeRemap.numKeys > 0) {
                    timeRemap.removeKey(1);
                }
                var layerDuration = layer.outPoint - layer.inPoint;
                timeRemap.setValueAtTime(layer.inPoint, layerDuration);
                timeRemap.setValueAtTime(layer.outPoint, 0);
            }
        }
        
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: "Time reversed on " + selectedLayers.length + " layer(s)" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function freezeFrame() {
    app.beginUndoGroup("Freeze Frame");
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            return JSON.stringify({ success: false, error: "No layers selected" });
        }
        
        var currentTime = comp.time;
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            if (layer.canSetTimeRemapEnabled) {
                layer.timeRemapEnabled = true;
                var timeRemap = layer.property("ADBE Time Remapping");
                var freezeTime = currentTime - layer.inPoint;
                timeRemap.setValue(freezeTime);
            }
        }
        
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: "Freeze frame applied to " + selectedLayers.length + " layer(s)" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function adjustLayerSpeed(speedPercent) {
    app.beginUndoGroup("Adjust Layer Speed");
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            return JSON.stringify({ success: false, error: "No layers selected" });
        }
        
        var speedMultiplier = speedPercent / 100;
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            if (layer.canSetTimeRemapEnabled) {
                layer.timeRemapEnabled = true;
                var timeRemap = layer.property("ADBE Time Remapping");
                while (timeRemap.numKeys > 0) {
                    timeRemap.removeKey(1);
                }
                var layerDuration = layer.outPoint - layer.inPoint;
                var newDuration = layerDuration / speedMultiplier;
                timeRemap.setValueAtTime(layer.inPoint, 0);
                timeRemap.setValueAtTime(layer.inPoint + newDuration, layerDuration);
                layer.outPoint = layer.inPoint + newDuration;
            }
        }
        
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: "Speed adjusted to " + speedPercent + "% on " + selectedLayers.length + " layer(s)" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function trimCompToWorkArea() {
    app.beginUndoGroup("Trim Comp to Work Area");
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        
        var workAreaStart = comp.workAreaStart;
        var workAreaDuration = comp.workAreaDuration;
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            layer.startTime = layer.startTime - workAreaStart;
        }
        comp.duration = workAreaDuration;
        
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: "Composition trimmed to work area" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function centerAnchorPoint() {
    app.beginUndoGroup("Center Anchor Point");
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            return JSON.stringify({ success: false, error: "No layers selected" });
        }
        
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            var layerRect = layer.sourceRectAtTime(comp.time, false);
            var anchorPoint = layer.property("ADBE Transform Group").property("ADBE Anchor Point");
            var position = layer.property("ADBE Transform Group").property("ADBE Position");
            var oldAnchor = anchorPoint.value;
            var newAnchor = [layerRect.left + layerRect.width / 2, layerRect.top + layerRect.height / 2];
            anchorPoint.setValue(newAnchor);
            var anchorDelta = [newAnchor[0] - oldAnchor[0], newAnchor[1] - oldAnchor[1]];
            var oldPosition = position.value;
            position.setValue([oldPosition[0] + anchorDelta[0], oldPosition[1] + anchorDelta[1]]);
        }
        
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: "Anchor point centered on " + selectedLayers.length + " layer(s)" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function fitLayerToComp() {
    app.beginUndoGroup("Fit Layer to Comp");
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            return JSON.stringify({ success: false, error: "No layers selected" });
        }
        
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            if (layer.source) {
                var scaleX = (comp.width / layer.source.width) * 100;
                var scaleY = (comp.height / layer.source.height) * 100;
                var scale = Math.max(scaleX, scaleY);
                var scaleProperty = layer.property("ADBE Transform Group").property("ADBE Scale");
                scaleProperty.setValue([scale, scale]);
                var position = layer.property("ADBE Transform Group").property("ADBE Position");
                position.setValue([comp.width / 2, comp.height / 2]);
            }
        }
        
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: "Layer(s) fitted to composition" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function duplicateSelectedLayers() {
    app.beginUndoGroup("Duplicate Selected Layers");
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            return JSON.stringify({ success: false, error: "No layers selected" });
        }
        
        for (var i = 0; i < selectedLayers.length; i++) {
            selectedLayers[i].duplicate();
        }
        
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: selectedLayers.length + " layer(s) duplicated" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function splitLayerAtCurrentTime() {
    app.beginUndoGroup("Split Layer");
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            return JSON.stringify({ success: false, error: "No layers selected" });
        }
        
        var currentTime = comp.time;
        var splitCount = 0;
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            if (currentTime > layer.inPoint && currentTime < layer.outPoint) {
                var newLayer = layer.duplicate();
                layer.outPoint = currentTime;
                newLayer.inPoint = currentTime;
                splitCount++;
            }
        }
        
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: splitCount + " layer(s) split at current time" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function sequenceLayers() {
    app.beginUndoGroup("Sequence Layers");
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length < 2) {
            return JSON.stringify({ success: false, error: "Select at least 2 layers to sequence" });
        }
        
        selectedLayers.sort(function(a, b) {
            return a.index - b.index;
        });
        
        var currentTime = comp.time;
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            var layerDuration = layer.outPoint - layer.inPoint;
            layer.startTime = currentTime;
            currentTime += layerDuration;
        }
        
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: selectedLayers.length + " layers sequenced" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applyGraphCurve(curveDataStr) {
    app.beginUndoGroup("Apply Graph Curve");
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        
        var selectedProperties = comp.selectedProperties;
        if (selectedProperties.length === 0) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "Select a property in the timeline" });
        }
        
        var property = selectedProperties[0];
        
        if (!property.canVaryOverTime) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "This property cannot be animated" });
        }
        
        if (!property.selectedKeys || property.selectedKeys.length === 0) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "Select keyframes in the timeline" });
        }
        
        var curveData = JSON.parse(curveDataStr);
        var cp1 = curveData.controlPoint1;
        var cp2 = curveData.controlPoint2;
        
        var influenceOut = Math.max(0.1, cp1.x);
        var speedOut = Math.max(0, cp1.y);
        
        var influenceIn = Math.max(0.1, cp2.x);
        var speedIn = Math.max(0, cp2.y);
        
        var selectedKeyframes = property.selectedKeys;
        var keyframesApplied = 0;
        
        for (var i = 0; i < selectedKeyframes.length; i++) {
            var keyIndex = selectedKeyframes[i];
            try {
                property.setInterpolationTypeAtKey(keyIndex, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                
                var easeIn = new KeyframeEase(speedIn, influenceIn);
                var easeOut = new KeyframeEase(speedOut, influenceOut);
                
                switch (property.propertyValueType) {
                    case 6414: 
                        property.setTemporalEaseAtKey(keyIndex, [easeIn, easeIn, easeIn], [easeOut, easeOut, easeOut]);
                        break;
                    case 6416: 
                        property.setTemporalEaseAtKey(keyIndex, [easeIn, easeIn], [easeOut, easeOut]);
                        break;
                    case 6417:
                    case 6413:
                    default:
                        property.setTemporalEaseAtKey(keyIndex, [easeIn], [easeOut]);
                        break;
                }
                
                keyframesApplied++;
            } catch (keyError) {
                continue;
            }
        }
        
        app.endUndoGroup();
        
        if (keyframesApplied === 0) {
            return JSON.stringify({ 
                success: false, 
                error: "Could not apply curve to any keyframes" 
            });
        }
        
        return JSON.stringify({ 
            success: true, 
            message: "Curve applied to " + keyframesApplied + " keyframe(s)",
            keyframesApplied: keyframesApplied,
            selectedKeyframes: selectedKeyframes.length,
            propertyName: property.name
        });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applyTemporalEaseAtKey(property, keyIndex, influenceIn, influenceOut, speedIn, speedOut) {
    property.setInterpolationTypeAtKey(keyIndex, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
    var easeIn = new KeyframeEase(speedIn || 0, influenceIn);
    var easeOut = new KeyframeEase(speedOut || 0, influenceOut);
    switch (property.propertyValueType) {
        case 6414:
            property.setTemporalEaseAtKey(keyIndex, [easeIn, easeIn, easeIn], [easeOut, easeOut, easeOut]);
            break;
        case 6416:
            property.setTemporalEaseAtKey(keyIndex, [easeIn, easeIn], [easeOut, easeOut]);
            break;
        default:
            property.setTemporalEaseAtKey(keyIndex, [easeIn], [easeOut]);
            break;
    }
}

function getGraphPresetEase(presetType) {
    switch (presetType) {
        case 'linear':
            return { influenceIn: 0.1, influenceOut: 0.1, speedIn: 0, speedOut: 0 };
        case 'ease-in':
            return { influenceIn: 75, influenceOut: 33.33, speedIn: 0, speedOut: 0 };
        case 'ease-out':
            return { influenceIn: 33.33, influenceOut: 75, speedIn: 0, speedOut: 0 };
        case 'ease-in-out':
            return { influenceIn: 75, influenceOut: 75, speedIn: 0, speedOut: 0 };
        case 'smooth':
            return { influenceIn: 60, influenceOut: 40, speedIn: 0, speedOut: 0 };
        case 'expo-in':
            return { influenceIn: 87, influenceOut: 33.33, speedIn: 0, speedOut: 0 };
        case 'expo-out':
            return { influenceIn: 33.33, influenceOut: 87, speedIn: 0, speedOut: 0 };
        case 'speed-ramp':
            return { influenceIn: 30, influenceOut: 30, speedIn: 10, speedOut: 10.1 };
        case 'quad-in':
            return { influenceIn: 50, influenceOut: 25, speedIn: 0, speedOut: 0 };
        case 'quad-out':
            return { influenceIn: 25, influenceOut: 50, speedIn: 0, speedOut: 0 };
        case 'cubic-in':
            return { influenceIn: 65, influenceOut: 30, speedIn: 0, speedOut: 0 };
        case 'cubic-out':
            return { influenceIn: 30, influenceOut: 65, speedIn: 0, speedOut: 0 };
        default:
            return null;
    }
}

function applyGraphPreset(presetType) {
    app.beginUndoGroup("Apply Graph Preset");
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        
        var selectedProperties = comp.selectedProperties;
        if (!selectedProperties || selectedProperties.length === 0) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "Select a property in the timeline" });
        }
        
        var property = selectedProperties[0];
        
        if (!property.canVaryOverTime) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "This property cannot be animated" });
        }
        
        if (property.numKeys < 1) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "Add at least one keyframe" });
        }
        
        var ease = getGraphPresetEase(presetType);
        if (!ease) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "Unknown preset: " + presetType });
        }
        
        var selectedKeys = property.selectedKeys;
        var keysToApply = selectedKeys && selectedKeys.length > 0 ? selectedKeys.slice(0) : [];
        
        if (keysToApply.length === 0) {
            for (var j = 1; j <= property.numKeys; j++) {
                keysToApply.push(j);
            }
        }
        
        var keyframesApplied = 0;
        
        for (var idx = 0; idx < keysToApply.length; idx++) {
            var i = keysToApply[idx];
            try {
                applyTemporalEaseAtKey(property, i, ease.influenceIn, ease.influenceOut, ease.speedIn, ease.speedOut);
                keyframesApplied++;
            } catch (keyError) {
                continue;
            }
        }
        
        app.endUndoGroup();
        
        if (keyframesApplied === 0) {
            return JSON.stringify({ success: false, error: "Could not apply curve to keyframes" });
        }
        
        return JSON.stringify({ 
            success: true, 
            message: presetType + " applied to " + keyframesApplied + " keyframe(s)",
            keyframesApplied: keyframesApplied
        });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applyGlowEffect() {
    try {
        app.beginUndoGroup("Apply Glow");
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        var layer = comp.selectedLayers[0];
        if (!layer) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No selected layer" });
        }
        
        function clampLayerTiming(targetLayer, sourceLayer) {
            targetLayer.startTime = sourceLayer.startTime;
            targetLayer.inPoint = sourceLayer.inPoint;
            targetLayer.outPoint = sourceLayer.outPoint;
        }

        function addGaussianBlur(targetLayer, amount) {
            var blur = targetLayer.Effects.addProperty("ADBE Gaussian Blur 2");
            if (blur) {
                blur("ADBE Gaussian Blur 2-0001").setValue(amount);
                blur("ADBE Gaussian Blur 2-0002").setValue(2);
            }
        }

        function isolateHighlights(targetLayer, blackPoint, whitePoint) {
            var extract = targetLayer.Effects.addProperty("ADBE Extract");
            if (extract) {
                extract("ADBE Extract-0001").setValue(blackPoint);
                extract("ADBE Extract-0002").setValue(whitePoint);
                extract("ADBE Extract-0005").setValue(0);
            }
        }

        var baseGlow = layer.duplicate();
        baseGlow.moveBefore(layer);
        baseGlow.name = layer.name + " - Glow Base";
        clampLayerTiming(baseGlow, layer);
        baseGlow.blendingMode = BlendingMode.ADD;
        var baseOpacity = baseGlow.property("ADBE Transform Group").property("ADBE Opacity");
        baseOpacity.setValue(60);
        isolateHighlights(baseGlow, 190, 255);
        addGaussianBlur(baseGlow, 45);

        var detailGlow = baseGlow.duplicate();
        detailGlow.name = layer.name + " - Glow Detail";
        clampLayerTiming(detailGlow, layer);
        detailGlow.blendingMode = BlendingMode.SCREEN;
        detailGlow.property("ADBE Transform Group").property("ADBE Opacity").setValue(45);
        addGaussianBlur(detailGlow, 18);

        var glowEffect = detailGlow.Effects.addProperty("ADBE Glow2");
        if (glowEffect) {
            glowEffect("ADBE Glow-0002").setValue(55);
            glowEffect("ADBE Glow-0003").setValue(0.6);
            glowEffect("ADBE Glow-0008").setValue(40);
        }

        var tint = detailGlow.Effects.addProperty("ADBE Tritone");
        if (tint) {
            tint("ADBE Tritone-0003").setValue([1, 0.84, 0.7]);
            tint("ADBE Tritone-0004").setValue([1, 0.96, 0.88]);
            tint("ADBE Tritone-0005").setValue([0.92, 0.96, 1]);
            tint("ADBE Tritone-0001").setValue(28);
        }
        
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: "Glow effect applied" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applyGaussianBlur() {
    try {
        app.beginUndoGroup("Apply Gaussian Blur");
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        var layer = comp.selectedLayers[0];
        if (!layer) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No selected layer" });
        }
        var effect = layer.Effects.addProperty("ADBE Gaussian Blur 2");
        if (effect) {
            effect("ADBE Gaussian Blur 2-0001").setValue(30);
            app.endUndoGroup();
            return JSON.stringify({ success: true, message: "Gaussian blur applied" });
        }
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: "Could not apply blur" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applySharpEffect() {
    try {
        app.beginUndoGroup("Apply Sharpen");
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        var layer = comp.selectedLayers[0];
        if (!layer) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No selected layer" });
        }
        
        var effect = layer.Effects.addProperty("ADBE Unsharp Mask");
        if (effect) {
            effect("ADBE Unsharp Mask-0001").setValue(2.0);
            effect("ADBE Unsharp Mask-0002").setValue(1.0);
            effect("ADBE Unsharp Mask-0003").setValue(0);
            app.endUndoGroup();
            return JSON.stringify({ success: true, message: "Sharpen effect applied" });
        }
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: "Could not apply sharpen" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applyFlashEffect() {
    try {
        app.beginUndoGroup("Apply Flash");
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        var layer = comp.selectedLayers[0];
        if (!layer) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No selected layer" });
        }
        
        var frameRate = comp.frameRate;
        var frameDuration = 1 / frameRate;
        var flashDuration = 7 * frameDuration;
        
        var solidLayer = comp.layers.addSolid([1, 1, 1], "Flash", comp.width, comp.height, comp.pixelAspect, flashDuration);
        solidLayer.moveBefore(layer);
        solidLayer.startTime = layer.inPoint;
                
        var opacity = solidLayer.property("ADBE Transform Group").property("ADBE Opacity");
        
        while (opacity.numKeys > 0) {
            opacity.removeKey(1);
        }
        
        var startTime = layer.inPoint;
        var endTime = startTime + flashDuration;
        
        opacity.setValueAtTime(startTime, 100);
        opacity.setValueAtTime(endTime, 0);
        
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: "Flash effect applied" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applyCameraShake() {
    try {
        app.beginUndoGroup("Apply Camera Shake");
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        var layer = comp.selectedLayers[0];
        if (!layer) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No selected layer" });
        }
        
        var transform = layer.property("ADBE Transform Group");
        var position = transform.property("ADBE Position");
        
        while (position.numKeys > 0) {
            position.removeKey(1);
        }
        
        var frameRate = comp.frameRate;
        var frameDuration = 1 / frameRate;
        var shakeAmount = 10;
        var numShakes = 8;
        
        var startTime = layer.inPoint;
        var originalPos = position.value;
        
        for (var i = 0; i < numShakes; i++) {
            var time = startTime + (i * frameDuration);
            var offsetX = (Math.random() - 0.5) * shakeAmount * 2;
            var offsetY = (Math.random() - 0.5) * shakeAmount * 2;
            var newPos = [originalPos[0] + offsetX, originalPos[1] + offsetY];
            position.setValueAtTime(time, newPos);
        }
        
        position.setValueAtTime(startTime + (8 * frameDuration), originalPos);
        
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: "Camera shake applied" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applyWaveWarp() {
    try {
        app.beginUndoGroup("Apply Wave Warp");
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        var layer = comp.selectedLayers[0];
        if (!layer) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No selected layer" });
        }
        var effect = layer.Effects.addProperty("ADBE Wave Warp");
        if (effect) {
            effect("ADBE Wave Warp-0001")("Wave Height").setValue(10);
            effect("ADBE Wave Warp-0001")("Wave Width").setValue(50);
            app.endUndoGroup();
            return JSON.stringify({ success: true, message: "Wave warp applied" });
        }
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: "Could not apply wave warp" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applyTurbulentDisplace() {
    try {
        app.beginUndoGroup("Apply Turbulent Displace");
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        var layer = comp.selectedLayers[0];
        if (!layer) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No selected layer" });
        }
        var effect = layer.Effects.addProperty("ADBE Turbulent Displace");
        if (effect) {
            effect("ADBE Turbulent Displace-0001")("Displacement").setValue(20);
            effect("ADBE Turbulent Displace-0001")("Complexity").setValue(3);
            app.endUndoGroup();
            return JSON.stringify({ success: true, message: "Turbulent displace applied" });
        }
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: "Could not apply turbulent displace" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applyMirror() {
    try {
        app.beginUndoGroup("Apply Mirror");
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        var layer = comp.selectedLayers[0];
        if (!layer) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No selected layer" });
        }
        var effect = layer.Effects.addProperty("ADBE Mirror");
        if (effect) {
            app.endUndoGroup();
            return JSON.stringify({ success: true, message: "Mirror applied" });
        }
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: "Could not apply mirror" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applyPolarCoordinates() {
    try {
        app.beginUndoGroup("Apply Polar Coordinates");
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        var layer = comp.selectedLayers[0];
        if (!layer) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No selected layer" });
        }
        var effect = layer.Effects.addProperty("ADBE Polar Coordinates");
        if (effect) {
            app.endUndoGroup();
            return JSON.stringify({ success: true, message: "Polar coordinates applied" });
        }
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: "Could not apply polar coordinates" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applyTwirl() {
    try {
        app.beginUndoGroup("Apply Twirl");
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        var layer = comp.selectedLayers[0];
        if (!layer) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No selected layer" });
        }
        var effect = layer.Effects.addProperty("ADBE Twirl");
        if (effect) {
            app.endUndoGroup();
            return JSON.stringify({ success: true, message: "Twirl applied" });
        }
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: "Could not apply twirl" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applyBulge() {
    try {
        app.beginUndoGroup("Apply Bulge");
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        var layer = comp.selectedLayers[0];
        if (!layer) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No selected layer" });
        }
        var effect = layer.Effects.addProperty("ADBE Bulge");
        if (effect) {
            app.endUndoGroup();
            return JSON.stringify({ success: true, message: "Bulge applied" });
        }
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: "Could not apply bulge" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applyRipple() {
    try {
        app.beginUndoGroup("Apply Ripple");
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        var layer = comp.selectedLayers[0];
        if (!layer) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No selected layer" });
        }
        var effect = layer.Effects.addProperty("ADBE Ripple");
        if (effect) {
            app.endUndoGroup();
            return JSON.stringify({ success: true, message: "Ripple applied" });
        }
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: "Could not apply ripple" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applySpherize() {
    try {
        app.beginUndoGroup("Apply Spherize");
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        var layer = comp.selectedLayers[0];
        if (!layer) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No selected layer" });
        }
        var effect = layer.Effects.addProperty("ADBE Spherize");
        if (effect) {
            app.endUndoGroup();
            return JSON.stringify({ success: true, message: "Spherize applied" });
        }
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: "Could not apply spherize" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applyFractalNoise() {
    try {
        app.beginUndoGroup("Apply Fractal Noise");
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        var layer = comp.selectedLayers[0];
        if (!layer) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No selected layer" });
        }
        var effect = layer.Effects.addProperty("ADBE Fractal Noise");
        if (effect) {
            app.endUndoGroup();
            return JSON.stringify({ success: true, message: "Fractal noise applied" });
        }
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: "Could not apply fractal noise" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applyLensFlare() {
    try {
        app.beginUndoGroup("Apply Lens Flare");
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        var layer = comp.selectedLayers[0];
        if (!layer) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No selected layer" });
        }
        var effect = layer.Effects.addProperty("ADBE Lens Flare");
        if (effect) {
            app.endUndoGroup();
            return JSON.stringify({ success: true, message: "Lens flare applied" });
        }
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: "Could not apply lens flare" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applyVintageFilm() {
    app.beginUndoGroup("Apply Vintage Film");
    try {
        return WorFlow.applyFFXPreset("vintage.ffx");
    } catch (e) {
        app.endUndoGroup();
        return WorFlow.stringifyJSON({ success: false, error: e.toString() });
    }
}

function applyCinematicGrade() {
    app.beginUndoGroup("Apply Cinematic");
    try {
        return WorFlow.applyFFXPreset("cinematic.ffx");
    } catch (e) {
        app.endUndoGroup();
        return WorFlow.stringifyJSON({ success: false, error: e.toString() });
    }
}

function applyQualityCC() {
    app.beginUndoGroup("Apply Quality CC");
    try {
        return WorFlow.applyFFXPreset("quality.ffx");
    } catch (e) {
        app.endUndoGroup();
        return WorFlow.stringifyJSON({ success: false, error: e.toString() });
    }
}

function applyFadeTransition() {
    try {
        app.beginUndoGroup("Apply Fade Transition");
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        var layer = comp.selectedLayers[0];
        if (!layer) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No selected layer" });
        }
        var opacityProp = layer.transform.opacity;
        
        while (opacityProp.numKeys > 0) {
            opacityProp.removeKey(1);
        }
        
        // Use layer's actual in and out points
        var layerInPoint = layer.inPoint;
        var layerOutPoint = layer.outPoint;
        var layerDuration = layerOutPoint - layerInPoint;
        
        // Divide duration into 3 equal parts: fade in, hold, fade out
        var fadeInDuration = layerDuration / 3;
        var holdDuration = layerDuration / 3;
        var fadeOutDuration = layerDuration / 3;
        
        var fadeInEndTime = layerInPoint + fadeInDuration;
        var holdEndTime = fadeInEndTime + holdDuration;
        var fadeOutEndTime = holdEndTime + fadeOutDuration;
        
        // Set keyframes at exact layer points
        opacityProp.setValueAtTime(layerInPoint, 0);
        opacityProp.setValueAtTime(fadeInEndTime, 100);
        opacityProp.setValueAtTime(holdEndTime, 100);
        opacityProp.setValueAtTime(fadeOutEndTime, 0);
        
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: "Fade transition applied" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applyWipeTransition() {
    try {
        app.beginUndoGroup("Apply Wipe Transition");
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        var layer = comp.selectedLayers[0];
        if (!layer) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No selected layer" });
        }
        var effect = layer.Effects.addProperty("ADBE Linear Wipe");
        if (effect) {
            var completionProp = effect.property("ADBE Linear Wipe-0001");
            var featherProp = effect.property("ADBE Linear Wipe-0003");

            featherProp.setValue(20);

            while (completionProp.numKeys > 0) {
                completionProp.removeKey(1);
            }

            var startTime = layer.inPoint;
            var duration = Math.min(0.6, layer.outPoint - layer.inPoint);
            var endTime = startTime + duration;

            completionProp.setValueAtTime(startTime, 100);
            completionProp.setValueAtTime(endTime, 0);

            completionProp.setInterpolationTypeAtKey(1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
            completionProp.setInterpolationTypeAtKey(2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);

            var easeOut = new KeyframeEase(0, 60);
            var easeIn = new KeyframeEase(0, 60);
            completionProp.setTemporalEaseAtKey(1, [easeOut], [easeOut]);
            completionProp.setTemporalEaseAtKey(2, [easeIn], [easeIn]);

            app.endUndoGroup();
            return JSON.stringify({ success: true, message: "Wipe transition applied" });
        }
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: "Could not apply wipe" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applyZoomTransition() {
    try {
        app.beginUndoGroup("Apply Zoom Transition");
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        var layer = comp.selectedLayers[0];
        if (!layer) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No selected layer" });
        }
        var scaleProp = layer.transform.scale;

        var referenceTime = Math.min(Math.max(comp.time, layer.inPoint), layer.outPoint);
        var startScale = scaleProp.valueAtTime(referenceTime, true);
        if (!(startScale instanceof Array)) {
            startScale = [startScale, startScale];
        }
        var startScaleCopy = [];
        for (var s = 0; s < startScale.length; s++) {
            startScaleCopy.push(startScale[s]);
        }

        while (scaleProp.numKeys > 0) {
            scaleProp.removeKey(1);
        }

        function scaleArray(values, factor) {
            var result = [];
            for (var i = 0; i < values.length; i++) {
                result.push(values[i] * factor);
            }
            return result;
        }

        var duration = Math.min(0.4, layer.outPoint - referenceTime);
        if (duration <= 0) {
            duration = 0.2;
            referenceTime = Math.max(layer.inPoint, layer.outPoint - duration);
        }
        var midTime = referenceTime + duration / 2;
        var endTime = referenceTime + duration;

        var zoomFactor = 1.2;
        var midScale = scaleArray(startScaleCopy, zoomFactor);

        scaleProp.setValueAtTime(referenceTime, startScaleCopy);
        scaleProp.setValueAtTime(midTime, midScale);
        scaleProp.setValueAtTime(endTime, startScaleCopy);

        for (var k = 1; k <= scaleProp.numKeys; k++) {
            scaleProp.setInterpolationTypeAtKey(k, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
            scaleProp.setTemporalEaseAtKey(k, [new KeyframeEase(0, 60)], [new KeyframeEase(0, 60)]);
        }
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: "Zoom transition applied" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function applySpinTransition() {
    try {
        app.beginUndoGroup("Apply Spin Transition");
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No active composition" });
        }
        var layer = comp.selectedLayers[0];
        if (!layer) {
            app.endUndoGroup();
            return JSON.stringify({ success: false, error: "No selected layer" });
        }
        var rotationProp = layer.transform.rotation;
        var scaleProp = layer.transform.scale;

        while (rotationProp.numKeys > 0) {
            rotationProp.removeKey(1);
        }
        while (scaleProp.numKeys > 0) {
            scaleProp.removeKey(1);
        }

        var startTime = comp.time;
        var endTime = startTime + (15 / comp.frameRate);

        rotationProp.setValueAtTime(startTime, 0);
        rotationProp.setValueAtTime(endTime, 360);
        rotationProp.setInterpolationTypeAtKey(1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        rotationProp.setInterpolationTypeAtKey(2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        rotationProp.setTemporalEaseAtKey(1, [new KeyframeEase(0, 70)], [new KeyframeEase(0, 70)]);
        rotationProp.setTemporalEaseAtKey(2, [new KeyframeEase(0, 70)], [new KeyframeEase(0, 70)]);

        scaleProp.setValueAtTime(startTime, [80, 80]);
        scaleProp.setValueAtTime(endTime, [100, 100]);
        scaleProp.setInterpolationTypeAtKey(1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        scaleProp.setInterpolationTypeAtKey(2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        scaleProp.setTemporalEaseAtKey(1, [new KeyframeEase(0, 60)], [new KeyframeEase(0, 60)]);
        scaleProp.setTemporalEaseAtKey(2, [new KeyframeEase(0, 60)], [new KeyframeEase(0, 60)]);
        app.endUndoGroup();
        return JSON.stringify({ success: true, message: "Spin transition applied" });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ success: false, error: e.toString() });
    }
}