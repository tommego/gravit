(function (_) {
    /**
     * Canvas implementation based on HTML5-Canvas implementation
     * @class GXViewCanvas
     * @extends GXPaintCanvas
     * @constructor
     */
    function GXViewCanvas() {
        var canvasElement = document.createElement("canvas");
        this._canvasContext = canvasElement.getContext("2d");
    }

    GObject.inherit(GXViewCanvas, GXPaintCanvas);

    /**
     * @type CanvasRenderingContext2D
     * @private
     */
    GXViewCanvas.prototype._canvasContext = null;

    /**
     * @type GTransform
     * @private
     */
    GXViewCanvas.prototype._transform = null;

    /** @override */
    GXViewCanvas.prototype.resize = function (width, height) {
        if (width != this._width || height != this._height) {
            this._canvasContext.canvas.width = width;
            this._canvasContext.canvas.height = height;
            GXPaintCanvas.prototype.resize.call(this, width, height);
        }
    };

    /** @override */
    GXViewCanvas.prototype.getTransform = function () {
        // Too bad, HTMLCanvas doesn't return the current transform :(
        return this._transform;
    };

    /** @override */
    GXViewCanvas.prototype.setTransform = function (transform) {
        if (!GTransform.equals(this._transform, transform)) {
            if (transform == null) {
                // Use identity transform
                transform = new GTransform();
            }
            var oldTransform = this._transform;
            this._transform = transform;
            var matrix = this._transform.getMatrix();
            this._canvasContext.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
            return oldTransform;
        }
        return this._transform;
    };

    /** @override */
    GXViewCanvas.prototype.prepare = function (areas) {
        // save context before anything else
        this._canvasContext.save();

        // reset some stuff
        this._transform = new GTransform();

        // Clip and clear our areas if any
        if (areas && areas.length > 0) {
            this._canvasContext.beginPath();
            for (var i = 0; i < areas.length; ++i) {
                var rect = areas[i];

                var xMin = rect.getX();
                var xMax = xMin + rect.getWidth();
                var yMin = rect.getY();
                var yMax = yMin + rect.getHeight();

                this._canvasContext.moveTo(xMin, yMin);
                this._canvasContext.lineTo(xMax, yMin);
                this._canvasContext.lineTo(xMax, yMax);
                this._canvasContext.lineTo(xMin, yMax);
                this._canvasContext.lineTo(xMin, yMin);
                this._canvasContext.clearRect(xMin, yMin, xMax - xMin, yMax - yMin);
            }
            this._canvasContext.clip();
        }
    };

    /** @override */
    GXViewCanvas.prototype.finish = function () {
        this._canvasContext.restore();
    };

    /** @override */
    GXViewCanvas.prototype.createCanvas = function () {
        return new GXViewCanvas();
    };

    /** @override */
    GXViewCanvas.prototype.createPattern = function (image, repeat) {
        return this._canvasContext.createPattern(this._convertImage(image), this._convertRepeat(repeat));
    };

    /** @override */
    GXPaintCanvas.prototype.clipRect = function (x, y, width, height) {
        // Too bad we need to use expensive save() / restore() on canvas for now for clipping :(
        this._canvasContext.save();
        this._canvasContext.beginPath();
        this._canvasContext.moveTo(x, y);
        this._canvasContext.lineTo(x + width, y);
        this._canvasContext.lineTo(x + width, y + height);
        this._canvasContext.lineTo(x, y + height);
        this._canvasContext.lineTo(x, y);
        this._canvasContext.clip();
    };

    /** @override */
    GXViewCanvas.prototype.putVertices = function (vertexSource) {
        if (vertexSource.rewindVertices(0)) {
            this._canvasContext.beginPath();

            var vertex = new GXVertex();
            while (vertexSource.readVertex(vertex)) {
                switch (vertex.command) {
                    case GXVertex.Command.Move:
                        this._canvasContext.moveTo(vertex.x, vertex.y);
                        break;
                    case GXVertex.Command.Line:
                        this._canvasContext.lineTo(vertex.x, vertex.y);
                        break;
                    case GXVertex.Command.Curve:
                    {
                        var xTo = vertex.x;
                        var yTo = vertex.y;
                        if (vertexSource.readVertex(vertex)) {
                            this._canvasContext.quadraticCurveTo(vertex.x, vertex.y, xTo, yTo);
                        }
                    }
                        break;
                    case GXVertex.Command.Curve2:
                    {
                        var xTo = vertex.x;
                        var yTo = vertex.y;
                        if (vertexSource.readVertex(vertex)) {
                            var cx1 = vertex.x;
                            var cy1 = vertex.y;
                            if (vertexSource.readVertex(vertex)) {
                                this._canvasContext.bezierCurveTo(cx1, cy1, vertex.x, vertex.y, xTo, yTo);
                            }
                        }
                    }
                        break;
                    case GXVertex.Command.Close:
                        this._canvasContext.closePath();
                        break;
                    default:
                        throw new Error("Unknown Command Type - " + vertex.command);
                }
            }
        }
    };

    /** @override */
    GXViewCanvas.prototype.clipVertices = function () {
        // Too bad we need to use expensive save() / restore() on canvas for now for clipping :(
        this._canvasContext.save();
        this._canvasContext.clip();
    };

    /** @override */
    GXViewCanvas.prototype.resetClip = function () {
        this._canvasContext.restore();
    };

    /** @override */
    GXViewCanvas.prototype.strokeVertices = function (stroke, width, cap, join, miterLimit, alignment, opacity, composite) {
        this._canvasContext.strokeStyle = this._convertStyle(stroke);

        if (typeof width == "number") {
            this._canvasContext.lineWidth = width;
        } else {
            this._canvasContext.lineWidth = 1.0;
        }

        if (typeof cap == "number") {
            switch (cap) {
                case GXViewCanvas.LineCap.Butt:
                    this._canvasContext.lineCap = "butt";
                    break;
                case GXViewCanvas.LineCap.Round:
                    this._canvasContext.lineCap = "round";
                    break;
                case GXViewCanvas.LineCap.Square:
                    this._canvasContext.lineCap = "square";
                    break;
            }
        } else {
            this._canvasContext.lineCap = "butt";
        }

        if (typeof join == "number") {
            switch (join) {
                case GXViewCanvas.LineJoin.Bevel:
                    this._canvasContext.lineJoin = "bevel";
                    break;
                case GXViewCanvas.LineJoin.Round:
                    this._canvasContext.lineJoin = "round";
                    break;
                default:
                    this._canvasContext.lineJoin = "miter";
                    this._canvasContext.miterLimit = typeof miterLimit == 'number' ? miterLimit : 10;
                    break;
            }
        } else {
            this._canvasContext.lineJoin = "miter";
            this._canvasContext.miterLimit = 10;
        }

        if (typeof opacity == "number") {
            this._canvasContext.globalAlpha = opacity;
        } else {
            this._canvasContext.globalAlpha = 1.0;
        }

        if (typeof composite == "number") {
            this._canvasContext.globalCompositeOperation = this._convertComposite(composite, "source-over");
        } else {
            this._canvasContext.globalCompositeOperation = "source-over";
        }

        this._canvasContext.stroke();
    };

    /** @override */
    GXViewCanvas.prototype.fillVertices = function (fill, opacity, composite) {
        // save fill to avoid expensive recalculation
        this._canvasContext.fillStyle = this._convertStyle(fill);

        if (typeof opacity == "number") {
            this._canvasContext.globalAlpha = opacity;
        } else {
            this._canvasContext.globalAlpha = 1.0;
        }

        if (typeof composite == "number") {
            this._canvasContext.globalCompositeOperation = this._convertComposite(composite, "source-over");
        } else {
            this._canvasContext.globalCompositeOperation = "source-over";
        }

        this._canvasContext.fill();
    };

    /** @override */
    GXViewCanvas.prototype.drawImage = function (image, x, y, noSmooth, opacity, composite) {
        x = x || 0;
        y = y || 0;
        image = this._convertImage(image);

        if (typeof opacity == "number") {
            this._canvasContext.globalAlpha = opacity;
        } else {
            this._canvasContext.globalAlpha = 1.0;
        }

        if (typeof composite == "number") {
            this._canvasContext = this._convertComposite(composite, "source-over");
        } else {
            this._canvasContext.globalCompositeOperation = "source-over";
        }

        var hadSmooth = this._getImageSmoothingEnabled();
        this._setImageSmoothingEnabled(!noSmooth);

        this._canvasContext.drawImage(image, x ? x : 0, y ? y : 0);

        this._setImageSmoothingEnabled(hadSmooth);
    };

    /** @override */
    GXViewCanvas.prototype.fillRect = function (x, y, width, height, fill) {
        fill = this._convertStyle(fill ? fill : gColor.build(0, 0, 0));
        this._canvasContext.fillStyle = fill;
        this._canvasContext.fillRect(x, y, width, height);
    };

    /** @override */
    GXViewCanvas.prototype.strokeRect = function (x, y, width, height, strokeWidth, stroke) {
        stroke = this._convertStyle(stroke ? stroke : gColor.build(0, 0, 0));
        strokeWidth = strokeWidth || 1.0;
        this._canvasContext.strokeStyle = stroke;
        this._canvasContext.lineWidth = strokeWidth;
        this._canvasContext.strokeRect(x, y, width, height);
    };

    /** @override */
    GXViewCanvas.prototype.strokeLine = function (x1, y1, x2, y2, strokeWidth, stroke) {
        stroke = this._convertStyle(stroke ? stroke : gColor.build(0, 0, 0));
        strokeWidth = strokeWidth || 1.0;
        this._canvasContext.strokeStyle = stroke;
        this._canvasContext.lineWidth = strokeWidth;
        this._canvasContext.beginPath();
        this._canvasContext.moveTo(x1, y1);
        this._canvasContext.lineTo(x2, y2);
        this._canvasContext.stroke();
    };

    /**
     * @param {Number} composite
     * @param {String} defaultReturn
     * @returns {String}
     * @private
     */
    GXViewCanvas.prototype._convertComposite = function (composite, defaultReturn) {
        if (typeof composite == "number") {
            switch (composite) {
                case GXViewCanvas.CompositeOperator.SourceOver:
                    return "source-over";
                case GXViewCanvas.CompositeOperator.SourceAtTop:
                    return "source-atop";
                case GXViewCanvas.CompositeOperator.SourceIn:
                    return "source-in";
                case GXViewCanvas.CompositeOperator.SourceOut:
                    return "source-out";
                case GXViewCanvas.CompositeOperator.DestinationOver:
                    return "destination-over";
                case GXViewCanvas.CompositeOperator.DestinationAtTop:
                    return "destination-atop";
                case GXViewCanvas.CompositeOperator.DestinationIn:
                    return "destination-in";
                case GXViewCanvas.CompositeOperator.DestinationOut:
                    return "destination-out";
                case GXViewCanvas.CompositeOperator.Lighter:
                    return "lighter";
                case GXViewCanvas.CompositeOperator.Darker:
                    return "darker";
                case GXViewCanvas.CompositeOperator.Copy:
                    return "copy";
                case GXViewCanvas.CompositeOperator.Xor:
                    return "xor";
                default:
                    break;
            }
        }
        return defaultReturn;
    };

    /**
     * @param {*} style
     * @param {*} defaultReturn
     * @returns {*}
     * @private
     */
    GXViewCanvas.prototype._convertStyle = function (style) {
        // TODO : Support color conversion using paint configuration color profiles

        if (style instanceof CanvasPattern) {
            return style;
        } else if (style instanceof GXColor) {
            return style.asCSSString();
        } else if (style instanceof GXGradient) {
            var grd = this._canvasContext.createLinearGradient(0, 0, 100, 0);
            for (var i = 0; i < style.getStops().length; ++i) {
                grd.addColorStop(style.getStops()[i].position / 100.0, style.getStops()[i].color.asCSSString());
            }
            return grd;
        } else if (typeof style === 'number') {
            return gColor.toCSS(style);
        } else {
            throw new Error('Not Supported.');
        }
    };

    /** @private */
    GXViewCanvas.prototype._convertImage = function (image) {
        if (image instanceof Image) {
            return image;
        } else if (image instanceof GXViewCanvas) {
            return image._canvasContext.canvas;
        } else {
            throw new Error('Not Supported.');
        }
    };

    /** @private */
    GXViewCanvas.prototype._convertRepeat = function (repeat) {
        switch (repeat) {
            case GXPaintCanvas.RepeatMode.Both:
                return "repeat";
            case GXPaintCanvas.RepeatMode.Horizontal:
                return "repeat-x";
            case GXPaintCanvas.RepeatMode.Vertical:
                return "repeat-y";
            case GXPaintCanvas.RepeatMode.None:
                return "no-repeat";
        }
    };

    var _imageSmoothingProperties = ['imageSmoothingEnabled', 'webkitImageSmoothingEnabled', 'mozImageSmoothingEnabled'];

    /** @private */
    GXViewCanvas.prototype._getImageSmoothingEnabled = function () {
        for (var i = 0; i < _imageSmoothingProperties.length; ++i) {
            if (this._canvasContext.hasOwnProperty(_imageSmoothingProperties[i])) {
                return this._canvasContext[_imageSmoothingProperties[i]];
            }
        }
        throw new Error('No Image-Smoothing-Enabled Setting available on Canvas.');
    };

    /** @private */
    GXViewCanvas.prototype._setImageSmoothingEnabled = function (smoothingEnabled) {
        for (var i = 0; i < _imageSmoothingProperties.length; ++i) {
            if (this._canvasContext.hasOwnProperty(_imageSmoothingProperties[i])) {
                this._canvasContext[_imageSmoothingProperties[i]] = smoothingEnabled;
                return;
            }
        }
        throw new Error('No Image-Smoothing-Enabled Setting available on Canvas.');
    };

    _.GXViewCanvas = GXViewCanvas;
})(this);