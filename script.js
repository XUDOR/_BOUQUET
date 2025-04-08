class QuadNode {
    constructor(x, y, width, height, parent = null) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.children = [];
        this.parent = parent;
        this.content = null;
        this.contentType = null;
        this.id = `node-${Math.random().toString(36).substr(2, 9)}`;
        this.backgroundColor = null;
        this.element = null;
    }
    
    splitHorizontal(ratio = 0.5) {
        if (this.children.length > 0) return;
        
        const height1 = this.height * ratio;
        const height2 = this.height - height1;
        
        const child1 = new QuadNode(this.x, this.y, this.width, height1, this);
        const child2 = new QuadNode(this.x, this.y + height1, this.width, height2, this);
        
        this.children = [child1, child2];
        return this.children;
    }
    
    splitVertical(ratio = 0.5) {
        if (this.children.length > 0) return;
        
        const width1 = this.width * ratio;
        const width2 = this.width - width1;
        
        const child1 = new QuadNode(this.x, this.y, width1, this.height, this);
        const child2 = new QuadNode(this.x + width1, this.y, width2, this.height, this);
        
        this.children = [child1, child2];
        return this.children;
    }
    
    isSplit() {
        return this.children.length > 0;
    }
    
    findNodeAt(x, y) {
        // Check if point is within this node's bounds
        if (x < this.x || x > this.x + this.width || y < this.y || y > this.y + this.height) {
            return null;
        }
        
        // If this node has children, recursively check them
        if (this.children.length > 0) {
            for (const child of this.children) {
                const foundNode = child.findNodeAt(x, y);
                if (foundNode) {
                    return foundNode;
                }
            }
        }
        
        // If no children contain the point, return this node
        return this;
    }
    
    createGrid(rows, cols) {
        if (this.children.length > 0) return;
        
        const cellWidth = this.width / cols;
        const cellHeight = this.height / rows;
        
        // First split horizontally for rows
        let rowNodes = [this];
        for (let i = 1; i < rows; i++) {
            const newRowNodes = [];
            for (const node of rowNodes) {
                const ratio = 1 / (rows - i + 1);
                const [top, bottom] = node.splitHorizontal(ratio);
                newRowNodes.push(bottom);
            }
            rowNodes = newRowNodes;
        }
        
        // Then split each row vertically for columns
        const getAllLeafNodes = (node) => {
            if (node.children.length === 0) {
                return [node];
            } else {
                return node.children.flatMap(child => getAllLeafNodes(child));
            }
        };
        
        const allLeafNodes = getAllLeafNodes(this);
        
        for (const node of allLeafNodes) {
            for (let i = 1; i < cols; i++) {
                const ratio = 1 / (cols - i + 1);
                const [left, right] = node.splitVertical(ratio);
                node = right;
            }
        }
    }
    
    setContent(content, type = 'text') {
        if (this.children.length > 0) return;
        this.content = content;
        this.contentType = type;
        return this;
    }
    
    setBackgroundColor(color) {
        this.backgroundColor = color;
        return this;
    }
    
    remove() {
        if (this.parent) {
            this.parent.children = this.parent.children.filter(child => child !== this);
        }
        return null;
    }
    
    getAllNodes() {
        let nodes = [this];
        
        for (const child of this.children) {
            nodes = nodes.concat(child.getAllNodes());
        }
        
        return nodes;
    }
    
    toJSON() {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            content: this.content,
            contentType: this.contentType,
            backgroundColor: this.backgroundColor,
            children: this.children.map(child => child.toJSON())
        };
    }
  }
  
  class LayoutGenerator {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        
        // Start with desktop size instead of canvas.clientWidth
        this.rootNode = new QuadNode(0, 0, 1440, 900); // Desktop size
        
        this.currentRatio = 0.5;
        this.selectedNode = null;
        this.panningOffsetX = 0;
        this.panningOffsetY = 0;
        this.isPanning = false;
        this.lastPanPosition = { x: 0, y: 0 };
        this.scale = 1;
        this.currentTool = 'select';
        
        this.init();
    }
    
    init() {
        this.render();
        this.setupEventListeners();
        this.createInitialLayout();
    }
    
    createInitialLayout() {
        // Create a simple initial layout with header, content, and footer
        const [top, bottom] = this.rootNode.splitHorizontal(0.1);
        const [content, footer] = bottom.splitHorizontal(0.9);
        const [leftSidebar, mainContent] = content.splitVertical(0.3);
        
        // Add some styling
        top.setBackgroundColor('#3a86ff').setContent('Header', 'nav');
        leftSidebar.setBackgroundColor('#f8f9fa').setContent('Sidebar');
        mainContent.setBackgroundColor('#ffffff').setContent('Main Content');
        footer.setBackgroundColor('#212529').setContent('Footer');
        
        this.render();
    }
    
    setupEventListeners() {
        // DOM Element references
        const ratioInput = document.getElementById('ratio-input');
        const columnsInput = document.getElementById('columns-input');
        const gridBtn = document.getElementById('grid-btn');
        const resetBtn = document.getElementById('reset-btn');
        const exportBtn = document.getElementById('export-btn');
        const gridPanel = document.getElementById('grid-panel');
        const exportPanel = document.getElementById('export-panel');
        const gridPanelClose = document.getElementById('grid-panel-close');
        const exportPanelClose = document.getElementById('export-panel-close');
        const applyGridBtn = document.getElementById('apply-grid');
        const gridTemplates = document.querySelectorAll('.grid-template');
        const gridRows = document.getElementById('grid-rows');
        const gridColumns = document.getElementById('grid-columns');
        const exportFormat = document.getElementById('export-format');
        const copyExportBtn = document.getElementById('copy-export');
        const exportCode = document.getElementById('export-code');
        const zoomIn = document.getElementById('zoom-in');
        const zoomOut = document.getElementById('zoom-out');
        const previewBtn = document.getElementById('preview-btn');
        const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');
        
        // Device viewport buttons
        const desktopBtn = document.getElementById('desktop-btn');
        const tabletBtn = document.getElementById('tablet-btn');
        const mobileBtn = document.getElementById('mobile-btn');
        
        // Set standard viewport sizes
        const viewportSizes = {
            desktop: { width: 1440, height: 900 },
            tablet: { width: 768, height: 1024 },
            mobile: { width: 375, height: 667 }
        };
        
        // Add click event listeners for device buttons
        desktopBtn.addEventListener('click', () => {
            this.resizeCanvas(viewportSizes.desktop.width, viewportSizes.desktop.height);
            updateActiveButton(desktopBtn);
        });
        
        tabletBtn.addEventListener('click', () => {
            this.resizeCanvas(viewportSizes.tablet.width, viewportSizes.tablet.height);
            updateActiveButton(tabletBtn);
        });
        
        mobileBtn.addEventListener('click', () => {
            this.resizeCanvas(viewportSizes.mobile.width, viewportSizes.mobile.height);
            updateActiveButton(mobileBtn);
        });
        
        // Helper function to update the active button
        function updateActiveButton(activeBtn) {
            [desktopBtn, tabletBtn, mobileBtn].forEach(btn => {
                btn.classList.remove('active');
            });
            activeBtn.classList.add('active');
        }
        
        // Set desktop as default selected
        desktopBtn.classList.add('active');
        
        // Update ratio value
        ratioInput.addEventListener('input', () => {
            this.currentRatio = ratioInput.value / 100;
        });
        
        // Reset layout
        resetBtn.addEventListener('click', () => {
            // Use the current selected viewport size for reset
            const activeBtn = document.querySelector('.device-btn.active');
            let size = viewportSizes.desktop; // Default
            
            if (activeBtn) {
                if (activeBtn === tabletBtn) size = viewportSizes.tablet;
                else if (activeBtn === mobileBtn) size = viewportSizes.mobile;
            }
            
            this.rootNode = new QuadNode(0, 0, size.width, size.height);
            this.createInitialLayout();
        });
        
        // Show grid panel
        gridBtn.addEventListener('click', () => {
            gridPanel.classList.add('active');
            exportPanel.classList.remove('active');
        });
        
        // Show export panel
        exportBtn.addEventListener('click', () => {
            exportPanel.classList.add('active');
            gridPanel.classList.remove('active');
            
            // Generate export code
            const format = exportFormat.value;
            exportCode.value = this.generateExportCode(format);
        });
        
        // Close panels
        gridPanelClose.addEventListener('click', () => {
            gridPanel.classList.remove('active');
        });
        
        exportPanelClose.addEventListener('click', () => {
            exportPanel.classList.remove('active');
        });
        
        // Apply grid to selected node
        applyGridBtn.addEventListener('click', () => {
            if (this.selectedNode) {
                const rows = parseInt(gridRows.value);
                const cols = parseInt(gridColumns.value);
                this.selectedNode.createGrid(rows, cols);
                this.render();
            }
        });
        
        // Apply grid templates
        gridTemplates.forEach(template => {
            template.addEventListener('click', () => {
                if (this.selectedNode) {
                    const rows = parseInt(template.dataset.rows);
                    const cols = parseInt(template.dataset.cols);
                    this.selectedNode.createGrid(rows, cols);
                    this.render();
                }
            });
        });
        
        // Copy export code
        copyExportBtn.addEventListener('click', () => {
            exportCode.select();
            document.execCommand('copy');
            copyExportBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyExportBtn.textContent = 'Copy';
            }, 2000);
        });
        
        // Update export code when format changes
        exportFormat.addEventListener('change', () => {
            exportCode.value = this.generateExportCode(exportFormat.value);
        });
        
        // Zoom controls
        zoomIn.addEventListener('click', () => {
            this.scale = Math.min(this.scale * 1.2, 3);
            this.applyTransform();
        });
        
        zoomOut.addEventListener('click', () => {
            this.scale = Math.max(this.scale / 1.2, 0.5);
            this.applyTransform();
        });
        
        // Preview mode
        previewBtn.addEventListener('click', () => {
            this.canvas.classList.toggle('preview');
            previewBtn.classList.toggle('active');
            this.render();
        });
        
        // Tool selection
        toolButtons.forEach(button => {
            button.addEventListener('click', () => {
                toolButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                this.currentTool = button.dataset.tool;
            });
        });
        
        // Canvas interaction events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Window resize event
        window.addEventListener('resize', () => {
            // Don't update the rootNode dimensions on window resize anymore
            // This keeps the layout stable regardless of the browser window size
            this.render();
        });
        
        // Initialize document level event listeners
        document.addEventListener('keydown', e => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.selectedNode && this.selectedNode.parent && this.selectedNode.parent.children.length > 1) {
                    this.selectedNode.remove();
                    this.selectedNode = null;
                    this.render();
                }
            }
        });
    }
    
    resizeCanvas(width, height) {
        // Store original scale to maintain content proportions
        const originalWidth = this.rootNode.width;
        const originalHeight = this.rootNode.height;
        
        // Calculate the scale ratio
        const widthRatio = width / originalWidth;
        const heightRatio = height / originalHeight;
        
        // Resize the root node
        this.rootNode.width = width;
        this.rootNode.height = height;
        
        // Recursively update all child nodes with the new scale
        const updateNodePosition = (node) => {
            node.x = node.x * widthRatio;
            node.y = node.y * heightRatio;
            node.width = node.width * widthRatio;
            node.height = node.height * heightRatio;
            
            for (const child of node.children) {
                updateNodePosition(child);
            }
        };
        
        // Apply the scaling to all nodes
        updateNodePosition(this.rootNode);
        
        // Reset panning and re-render
        this.panningOffsetX = 0;
        this.panningOffsetY = 0;
        this.render();
    }
    
    selectNode(node) {
        if (this.selectedNode) {
            const prevElement = document.querySelector(`.node[data-id="${this.selectedNode.id}"]`);
            if (prevElement) {
                prevElement.classList.remove('selected');
            }
        }
        
        this.selectedNode = node;
        
        const element = document.querySelector(`.node[data-id="${node.id}"]`);
        if (element) {
            element.classList.add('selected');
        }
    }
    
    deselectNode() {
        if (this.selectedNode) {
            const element = document.querySelector(`.node[data-id="${this.selectedNode.id}"]`);
            if (element) {
                element.classList.remove('selected');
            }
            this.selectedNode = null;
        }
    }
    
  
    handleMouseMove(e) {
        if (this.isPanning) {
            const dx = e.clientX - this.lastPanPosition.x;
            const dy = e.clientY - this.lastPanPosition.y;
            
            this.panningOffsetX += dx;
            this.panningOffsetY += dy;
            
            this.lastPanPosition = { x: e.clientX, y: e.clientY };
            this.applyTransform();
        }
    }
    
    handleMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = 'default';
        }
    }
    
    applyTransform() {
        const contentElement = this.canvas.querySelector('.canvas-content');
        if (contentElement) {
            contentElement.style.transform = `translate(${this.panningOffsetX}px, ${this.panningOffsetY}px) scale(${this.scale})`;
            contentElement.style.transformOrigin = '0 0';
        }
    }
    
    handleMouseDown(e) {
        if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
            // Middle button or Ctrl+Left button for panning
            this.isPanning = true;
            this.lastPanPosition = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
            return;
        }
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.panningOffsetX) / this.scale;
        const y = (e.clientY - rect.top - this.panningOffsetY) / this.scale;
        
        // Check if clicked on node control
        if (e.target.classList.contains('node-control-btn')) {
            const nodeId = e.target.closest('.node').dataset.id;
            const allNodes = this.rootNode.getAllNodes();
            const node = allNodes.find(n => n.id === nodeId);
            
            if (node) {
                if (e.target.classList.contains('split-h')) {
                    node.splitHorizontal(this.currentRatio);
                } else if (e.target.classList.contains('split-v')) {
                    node.splitVertical(this.currentRatio);
                } else if (e.target.classList.contains('delete')) {
                    // Only allow deleting if the parent has other children
                    if (node.parent && node.parent.children.length > 1) {
                        node.remove();
                    }
                }
                this.render();
            }
            return;
        }
        
        // Handle resizer drag starting here
        if (e.target.classList.contains('resizer')) {
            // Implement resizer functionality
            // ...
            return;
        }
        
        // Find the node at this position
        const node = this.rootNode.findNodeAt(x, y);
        
        if (node) {
            // If in select mode, just select the node
            if (this.currentTool === 'select') {
                this.selectNode(node);
            } else if (!node.isSplit()) {
                // If using a component tool and node isn't split, add content
                node.setContent(this.currentTool.charAt(0).toUpperCase() + this.currentTool.slice(1), this.currentTool);
                this.render();
            }
        } else {
            this.deselectNode();
        }
    }
    
    render() {
        // Clear the canvas
        this.canvas.innerHTML = '';
        
        // Create a container for transformed content
        const contentElement = document.createElement('div');
        contentElement.className = 'canvas-content';
        contentElement.style.position = 'absolute';
        contentElement.style.width = '100%';
        contentElement.style.height = '100%';
        contentElement.style.transform = `translate(${this.panningOffsetX}px, ${this.panningOffsetY}px) scale(${this.scale})`;
        contentElement.style.transformOrigin = '0 0';
        this.canvas.appendChild(contentElement);
        
        // Render all nodes
        const renderNode = (node) => {
            const nodeElement = document.createElement('div');
            nodeElement.className = 'node';
            if (node.isSplit()) {
                nodeElement.classList.add('split');
            }
            
            if (node === this.selectedNode) {
                nodeElement.classList.add('selected');
            }
            
            nodeElement.dataset.id = node.id;
            nodeElement.style.left = `${node.x}px`;
            nodeElement.style.top = `${node.y}px`;
            nodeElement.style.width = `${node.width}px`;
            nodeElement.style.height = `${node.height}px`;
            
            if (node.backgroundColor) {
                nodeElement.style.backgroundColor = node.backgroundColor;
            }
            
            // Add content if node has content and is not split
            if (node.content && !node.isSplit()) {
                if (node.contentType) {
                    const contentElement = document.createElement('div');
                    contentElement.className = `ui-component ${node.contentType}`;
                    contentElement.textContent = node.content;
                    contentElement.style.width = '100%';
                    contentElement.style.height = '100%';
                    nodeElement.appendChild(contentElement);
                } else {
                    nodeElement.textContent = node.content;
                }
            }
            
            // Add node controls if not in preview mode
            if (!this.canvas.classList.contains('preview')) {
                const controlsElement = document.createElement('div');
                controlsElement.className = 'node-controls';
                
                if (!node.isSplit()) {
                    const splitHorizontalBtn = document.createElement('button');
                    splitHorizontalBtn.className = 'node-control-btn split-h';
                    splitHorizontalBtn.textContent = '⊥';
                    splitHorizontalBtn.title = 'Split Horizontally';
                    controlsElement.appendChild(splitHorizontalBtn);
                    
                    const splitVerticalBtn = document.createElement('button');
                    splitVerticalBtn.className = 'node-control-btn split-v';
                    splitVerticalBtn.textContent = '‖';
                    splitVerticalBtn.title = 'Split Vertically';
                    controlsElement.appendChild(splitVerticalBtn);
                }
                
                if (node.parent && node.parent.children.length > 1) {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'node-control-btn delete';
                    deleteBtn.textContent = '×';
                    deleteBtn.title = 'Delete Node';
                    controlsElement.appendChild(deleteBtn);
                }
                
                nodeElement.appendChild(controlsElement);
                
                // Add node label (id or content type)
                const labelElement = document.createElement('div');
                labelElement.className = 'node-label';
                labelElement.textContent = node.contentType || 'node';
                nodeElement.appendChild(labelElement);
            }
            
            node.element = nodeElement;
            contentElement.appendChild(nodeElement);
            
            // Recursively render children
            for (const child of node.children) {
                renderNode(child);
            }
        };
        
        renderNode(this.rootNode);
    }
    
    generateExportCode(format) {
        if (format === 'html') {
            return this.generateHTMLCode();
        } else if (format === 'json') {
            return JSON.stringify(this.rootNode.toJSON(), null, 2);
        } else if (format === 'react') {
            return this.generateReactCode();
        }
        
        return '';
    }
    
    generateHTMLCode() {
        let html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Generated Layout</title>\n    <style>\n';
        
        // Basic CSS
        html += '* { box-sizing: border-box; margin: 0; padding: 0; }\n';
        html += 'body { font-family: sans-serif; }\n';
        html += '.container { width: 100%; height: 100vh; position: relative; }\n';
        
        // Generate CSS for each node
        const generateNodeCSS = (node, prefix = '') => {
            const selector = `#${node.id}`;
            html += `${selector} { position: absolute; left: ${node.x}px; top: ${node.y}px; width: ${node.width}px; height: ${node.height}px;`;
            
            // Add border to all nodes
            html += ` border: 1px solid #ced4da;`;
            
            if (node.backgroundColor) {
                html += ` background-color: ${node.backgroundColor};`;
            }
            
            html += ' }\n';
            
            // Component-specific CSS
            if (node.contentType) {
                if (node.contentType === 'button') {
                    html += `${selector} { display: flex; align-items: center; justify-content: center; background-color: #3a86ff; color: white; border-radius: 4px; }\n`;
                } else if (node.contentType === 'input') {
                    html += `${selector} { border: 2px solid #dee2e6; border-radius: 4px; padding: 8px; }\n`;
                } else if (node.contentType === 'nav') {
                    html += `${selector} { background-color: #212529; color: white; display: flex; align-items: center; padding: 8px; border-bottom: 2px solid #495057; }\n`;
                } else if (node.contentType === 'card') {
                    html += `${selector} { background-color: white; border: 1px solid #dee2e6; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 16px; }\n`;
                } else if (node.contentType === 'text') {
                    html += `${selector} { padding: 8px; }\n`;
                } else if (node.contentType === 'image') {
                    html += `${selector} { background-color: #e9ecef; display: flex; align-items: center; justify-content: center; }\n`;
                    html += `${selector}::after { content: 'Image'; color: #6c757d; }\n`;
                }
            }
            
            // Add border color that's slightly different for nested nodes to make hierarchy visible
            if (node.parent && node.parent !== this.rootNode) {
                html += `${selector}:hover { border-color: #6c757d; z-index: 1; }\n`;
            }
            
            // Generate CSS for children
            for (const child of node.children) {
                generateNodeCSS(child, prefix + '  ');
            }
        };
        
        generateNodeCSS(this.rootNode);
        
        html += '    </style>\n</head>\n<body>\n    <div class="container">\n';
        
        // Generate HTML for each node
        const generateNodeHTML = (node, indent = '        ') => {
            html += `${indent}<div id="${node.id}"`;
            
            if (node.contentType) {
                html += ` class="${node.contentType}"`;
            }
            
            html += '>\n';
            
            // Add content
            if (node.content && node.children.length === 0) {
                html += `${indent}    ${node.content}\n`;
            }
            
            // Generate HTML for children
            for (const child of node.children) {
                generateNodeHTML(child, indent + '    ');
            }
            
            html += `${indent}</div>\n`;
        };
        
        generateNodeHTML(this.rootNode);
        
        html += '    </div>\n</body>\n</html>';
        
        return html;
    }
  
    generateReactCode() {
        let code = "import React from 'react';\n\n";
        code += "const GeneratedLayout = () => {\n";
        code += "  return (\n";
        code += "    <div className=\"container\" style={{ position: 'relative', width: '100%', height: '100vh' }}>\n";
        
        // Generate React components for each node
        const generateNodeComponent = (node, indent = '      ') => {
            let styles = {
                position: 'absolute',
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: `${node.width}px`,
                height: `${node.height}px`,
                border: '1px solid #ced4da'  // Add border to all elements
            };
            
            if (node.backgroundColor) {
                styles.backgroundColor = node.backgroundColor;
            }
            
            // Component-specific styles
            if (node.contentType === 'button') {
                styles = {
                    ...styles,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#3a86ff',
                    color: 'white',
                    borderRadius: '4px'
                };
            } else if (node.contentType === 'input') {
                styles = {
                    ...styles,
                    border: '2px solid #dee2e6',
                    borderRadius: '4px',
                    padding: '8px'
                };
            } else if (node.contentType === 'nav') {
                styles = {
                    ...styles,
                    backgroundColor: '#212529',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px',
                    borderBottom: '2px solid #495057'
                };
            } else if (node.contentType === 'card') {
                styles = {
                    ...styles,
                    backgroundColor: 'white',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    padding: '16px'
                };
            } else if (node.contentType === 'image') {
                styles = {
                    ...styles,
                    backgroundColor: '#e9ecef',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                };
            }
            
            // Generate the style object string
            const styleStr = Object.entries(styles)
                .map(([key, value]) => `${key}: '${value}'`)
                .join(', ');
            
            code += `${indent}<div style={{ ${styleStr} }}`;
            
            if (node.contentType) {
                code += ` className="${node.contentType}"`;
            }
            
            code += '>\n';
            
            // Add content
            if (node.content && node.children.length === 0) {
                code += `${indent}  ${node.content}\n`;
            } else if (node.contentType === 'image') {
                // Add placeholder text for image components
                code += `${indent}  Image\n`;
            }
            
            // Generate components for children
            for (const child of node.children) {
                generateNodeComponent(child, indent + '  ');
            }
            
            code += `${indent}</div>\n`;
        };
        
        generateNodeComponent(this.rootNode);
        
        code += "    </div>\n";
        code += "  );\n";
        code += "};\n\n";
        code += "export default GeneratedLayout;";
        
        return code;
    }
  }
  
  // Initialize the layout generator when the DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    const generator = new LayoutGenerator('layout-canvas');
  });