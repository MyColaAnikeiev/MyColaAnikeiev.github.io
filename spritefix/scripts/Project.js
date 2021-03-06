/* New project is started when user opens Sprite */
class Project {
    constructor(img) {
        this.animations = new Map();
        this.selectedAnimation = null;
        /* Editing state machine flags */
        this.flags = {
            editing: false,
            baseBoxEditing: false,
            baseBoxResizeDraging: false,
            baseBoxDraging: false,
            framesMassPosotioning: false,
            frameEditingMode: false,
            frameSelected: false,
            frameMiddlePointSelection: false,
            cropFrameDrag: false
        };
        this.spriteWidth = img.width;
        this.spriteHeight = img.height;
        this.img = img;
        RTools.setImg(img);
        RTools.drawImage();
        this.grubDomElements();
        this.resetDom();
        this.setListeners();
        EditingTools.setProject(this);
        AnimationPlayer.setProject(this);
    }
    alowEditing() {
        setTimeout(() => {
            setTimeout(() => {
                this.flags.editing = false;
            }, 0);
        }, 0);
    }
    prohibitEditing() {
        this.flags.editing = true;
    }
    grubDomElements() {
        let query = (str) => document.querySelector(str);
        let byId = (str) => document.getElementById(str);
        this.html = {
            dragMenu: {
                saveJson: byId("save-json-btn"),
                openJson: byId("open-json-btn"),
                exportSprite: byId("export-sprite-btn")
            },
            mainCanvasComtainer: byId("source_view_container"),
            mainCanvas: byId('source_viewer'),
            addAnimationBtn: byId('add-animation-btn'),
            animListContainer: byId('anim-list-items'),
            baseBoxDialog: {
                container: query('.sizes-dialog-back'),
                widthInput: query(".sizes-dialog-back .input-width"),
                heightInput: query(".sizes-dialog-back .input-height"),
                button: query(".sizes-dialog-back button"),
            },
            editorTipsBlock: {
                container: byId('editor-tips-block'),
                frameAdder: {
                    stage1: query("#editor-tips-block .stage1"),
                    stage2: query("#editor-tips-block .stage2"),
                    container: query('#editor-tips-block .frames-adder'),
                    stickToAxisCheckout: query('#editor-tips-block .frames-adder input'),
                    selectedNumber: query('#editor-tips-block .frames-adder span.selected')
                }
            },
            animPreviewControls: {
                frameNumInput: query("#animation-preview-column .frame-num-input input"),
                showLast: query("#animation-preview-column button.show-last"),
                showLast2: query("#animation-preview-column button.show-last2"),
                showLast3: query("#animation-preview-column button.show-last3"),
                showAll: query("#animation-preview-column button.show-all"),
                untillSelectedCheckbox: query("#animation-preview-column .untill-selected input"),
                intervalDisplay: query("#animation-preview-column .speed-controls .display"),
                intervalDecrBtn: query("#animation-preview-column .speed-controls .down"),
                intervalIncrBtn: query("#animation-preview-column .speed-controls .up")
            },
            scaleControlInput: query("#animation-preview-column .scale-control input")
        };
    }
    resetDom() {
        this.html.animListContainer.innerHTML = '';
    }
    setListeners() {
        this.html.addAnimationBtn.onclick = () => {
            if (this.flags.editing)
                return;
            setTimeout(() => {
                let anim = new SpriteAnimation(this);
                this.selectedAnimation = anim;
            }, 4);
        };
        this.html.dragMenu.exportSprite.onclick = () => this.exportSprite();
        this.html.dragMenu.saveJson.onclick = () => {
            let aniArr = Array.from(this.animations.keys()).map(a => a.frames);
            let jsonBlob = new Blob([JSON.stringify(aniArr)], { type: "text/json" });
            let link = document.createElement("a");
            link.download = "sprite-fix.json";
            link.href = URL.createObjectURL(jsonBlob);
            link.click();
            URL.revokeObjectURL(link.href);
        };
        this.html.dragMenu.openJson.onclick = () => {
            let input = document.createElement("input");
            input.type = "file";
            input.style.display = 'none';
            document.body.appendChild(input);
            let project = this;
            input.onchange = function (e) {
                let file = e.target.files[0];
                if (!file)
                    return;
                if (file.type == "application/json") {
                    file.text().then(data => {
                        let anims = JSON.parse(data);
                        anims.forEach(a => {
                            project.addAnimationFromJson(a);
                        });
                    });
                }
                document.body.removeChild(input);
            };
            input.click();
        };
    }
    addAnimationFromJson(anim) {
        let newAnim = new SpriteAnimation(this, true);
        let { flags, html } = this;
        newAnim.frames = anim;
        /* HTML elements generation */
        let el = document.createElement('div');
        el.className = 'anim-list-item';
        el.innerHTML = `
            <div class="anim-name">${anim.animationName}</div>
            <div class="closer">Delete</div>
        `;
        html.animListContainer.appendChild(el);
        let delBtn = el.querySelector(".closer");
        this.animations.set(newAnim, el);
        /* Selection animation event */
        el.onclick = (e) => {
            if (flags.editing)
                return;
            // Don't listen to close button dude
            if (e.target == delBtn)
                return;
            newAnim.selectAsCurrent();
        };
        /* Removing animation event */
        delBtn.onclick = () => {
            if (flags.editing)
                return;
            html.animListContainer.removeChild(el);
            curProject.removeAnimation(newAnim);
        };
    }
    registerAnimation(listItem, anim) {
        this.animations.set(anim, listItem);
    }
    removeAnimation(anim) {
        anim.selfDestruct();
        this.animations.delete(anim);
        for (let key of this.animations.keys()) {
            key.selectAsCurrent();
            return;
        }
        AnimationPlayer.stop();
        RTools.drawImage();
    }
    // Sprite will be placed from left to right
    // from top to bottom. Each animation will
    // start with new row.
    exportSprite() {
        // (width / height)
        const minRatio = 0.5;
        const maxRatio = 2;
        let anims = Array.from(this.animations.keys());
        if (!anims.length) {
            alert("There is no animations to export.");
            return;
        }
        let maxWidth = this.animationsMaxFrameWidth(anims);
        /* Just loop sizes and choose minimum sprite sheet
         * area starting from ratio 'minRatio' but not
         * smaller then (maxWidth * 2 + 2) until ratio reach 'maxRatio'.
         */
        let sizes = this.findOptimalSizes(maxWidth, minRatio, maxRatio);
        let spriteSheet = this.showNewSpriteSheetCanvas(sizes);
        this.drawFramesOnSpriteSheet(sizes, spriteSheet);
    }
    drawFramesOnSpriteSheet(sizes, sheet) {
        let anims = Array.from(this.animations.keys());
        let { width, height } = sizes;
        // Target sprite position
        let curX = 0;
        let curY = 0;
        anims.forEach(an => {
            let { frames } = an;
            let fd = frames.frameDeltas;
            let base = frames.baseBox;
            // Source sprite position
            let shiftX = base.left;
            let shiftY = base.top;
            for (let ind = 0; ind < fd.length; ind++) {
                shiftX += fd[ind].xShift;
                shiftY += fd[ind].yShift;
                let newBase = {
                    x: shiftX,
                    y: shiftY,
                    width: base.width,
                    height: base.height
                };
                let targetPos = { x: curX, y: curY };
                RTools.fromFrameImageToSheet(sheet.ctx, newBase, fd[ind].crop, targetPos);
                curX += base.width + 1;
                let lastOne = ind + 1 == fd.length;
                if ((curX + base.width + 1) > sizes.width || lastOne) {
                    curX = 0;
                    curY += base.height + 1;
                }
            }
        });
    }
    showNewSpriteSheetCanvas(sizes) {
        let canvasContainer = this.genNewSpriteSheetContainer(sizes);
        let canvas;
        let ctx;
        document.body.appendChild(canvasContainer);
        canvas = canvasContainer.querySelector("canvas");
        ctx = canvas.getContext("2d");
        /* Close */
        canvasContainer.onmousedown = (e) => {
            if (e.button != 0)
                return;
            canvasContainer.onmousedown = null;
            document.body.removeChild(canvasContainer);
        };
        return { container: canvasContainer, ctx };
    }
    genNewSpriteSheetContainer(sizes) {
        let { width, height } = sizes;
        let cont = document.createElement("div");
        cont.classList.add("exported-image-container");
        cont.innerHTML = `
            <p>Right mouse click -> save image as.</p>
            <div>
                <canvas width="${width}" height="${height}" class="exported-image"></canvas>
            <div>
        `;
        return cont;
    }
    findOptimalSizes(frameMaxWidth, minRatio, maxRatio) {
        let smalestArea;
        let width = frameMaxWidth * 2 + 2;
        let height = this.getSpriteSheetHeight(width);
        let curWidth = width;
        while (true) {
            let curHeight = this.getSpriteSheetHeight(curWidth);
            let area = curWidth * curHeight;
            let ratio = curWidth / curHeight;
            if (smalestArea === undefined) {
                smalestArea = area;
            }
            if (smalestArea > area || width / height < minRatio) {
                width = curWidth;
                height = curHeight;
                smalestArea = area;
            }
            if (ratio > maxRatio)
                break;
            let step = this.calcSpriteWidthStep(curWidth);
            if (!step)
                break;
            curWidth += step;
        }
        return { width, height };
    }
    calcSpriteWidthStep(curWidth) {
        let anims = Array.from(this.animations.keys());
        let steps = [];
        anims.forEach(el => {
            let { frames } = el;
            let box = frames.baseBox;
            let fd = frames.frameDeltas;
            let fited = Math.floor(curWidth / (box.width + 1));
            if (fited >= fd.length)
                return;
            let step = (fited + 1) * (box.width + 1) - curWidth;
            if (step > 0)
                steps.push(step);
        });
        steps.sort((a, b) => a - b);
        if (steps.length)
            return steps[0];
        else
            return 0;
    }
    getSpriteSheetHeight(width) {
        let anims = Array.from(this.animations.keys());
        let height = 0;
        anims.forEach(an => {
            let { frames } = an;
            let box = frames.baseBox;
            let numOfFrames = frames.frameDeltas.length;
            let inRow = Math.floor(width / (box.width + 1));
            let lastRow = numOfFrames % inRow ? 1 : 0;
            let rows = Math.floor(numOfFrames / inRow) + lastRow;
            height += rows * (box.height + 1);
        });
        return height;
    }
    animationsMaxFrameWidth(anims) {
        let maxWidth = 0;
        anims.forEach(el => {
            let { width } = el.frames.baseBox;
            if (maxWidth < width)
                maxWidth = width;
        });
        return maxWidth;
    }
}
