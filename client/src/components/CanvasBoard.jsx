import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  upsertElement,
  removeElement,
  setSelectedElementId,
  setViewport,
  setActiveTool
} from '../store/canvasSlice';

export const CanvasBoard = ({
  emitElementUpdate,
  emitElementDelete,
  emitCursorMove,
  canvasRef
}) => {
  const dispatch = useDispatch();

  const elements = useSelector((state) => state.canvas.elements);
  const elementOrder = useSelector((state) => state.canvas.elementOrder);
  const selectedElementId = useSelector((state) => state.canvas.selectedElementId);
  const activeTool = useSelector((state) => state.canvas.activeTool);
  const toolSettings = useSelector((state) => state.canvas.toolSettings);
  const viewport = useSelector((state) => state.canvas.viewport);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingElement, setIsDraggingElement] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [initialElementData, setInitialElementData] = useState(null);

  // Active in-progress drawing shape
  const currentShapeRef = useRef(null);
  const lastCursorEmitRef = useRef(0);

  // Convert screen coordinates to canvas world coordinates
  const screenToWorld = useCallback(
    (screenX, screenY) => {
      return {
        x: (screenX - viewport.panX) / viewport.zoom,
        y: (screenY - viewport.panY) / viewport.zoom
      };
    },
    [viewport]
  );

  // Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationFrameId;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Dark canvas background with grid dots
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, width, height);

      // Save transform
      ctx.save();
      ctx.translate(viewport.panX, viewport.panY);
      ctx.scale(viewport.zoom, viewport.zoom);

      // Draw subtle infinite dot grid
      const gridSize = 32;
      const startX = Math.floor((-viewport.panX / viewport.zoom) / gridSize) * gridSize;
      const startY = Math.floor((-viewport.panY / viewport.zoom) / gridSize) * gridSize;
      const endX = startX + (width / viewport.zoom) + gridSize;
      const endY = startY + (height / viewport.zoom) + gridSize;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      for (let x = startX; x < endX; x += gridSize) {
        for (let y = startY; y < endY; y += gridSize) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw all elements in z-index order
      const renderList = elementOrder.map((id) => elements[id]).filter(Boolean);

      // If currently drawing, append preview
      if (currentShapeRef.current) {
        renderList.push(currentShapeRef.current);
      }

      renderList.forEach((el) => {
        drawElement(ctx, el, el.id === selectedElementId);
      });

      ctx.restore();
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [elements, elementOrder, selectedElementId, viewport, canvasRef]);

  // Helper: Draw individual element
  const drawElement = (ctx, el, isSelected) => {
    const d = el.data || {};
    ctx.save();
    ctx.strokeStyle = d.stroke || '#6366f1';
    ctx.fillStyle = d.fill || 'transparent';
    ctx.lineWidth = d.strokeWidth || 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (el.type) {
      case 'stroke':
        if (Array.isArray(d.points) && d.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(d.points[0].x, d.points[0].y);
          for (let i = 1; i < d.points.length; i++) {
            ctx.lineTo(d.points[i].x, d.points[i].y);
          }
          ctx.stroke();
        }
        break;

      case 'rectangle':
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(d.x, d.y, d.width, d.height, 6);
        } else {
          ctx.rect(d.x, d.y, d.width, d.height);
        }
        if (d.fill && d.fill !== 'transparent') ctx.fill();
        ctx.stroke();
        break;

      case 'circle': {
        ctx.beginPath();
        const rx = Math.abs(d.width / 2);
        const ry = Math.abs(d.height / 2);
        const cx = d.x + rx;
        const cy = d.y + ry;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (d.fill && d.fill !== 'transparent') ctx.fill();
        ctx.stroke();
        break;
      }

      case 'line':
        ctx.beginPath();
        ctx.moveTo(d.x1, d.y1);
        ctx.lineTo(d.x2, d.y2);
        ctx.stroke();
        break;

      case 'arrow': {
        ctx.beginPath();
        ctx.moveTo(d.x1, d.y1);
        ctx.lineTo(d.x2, d.y2);
        ctx.stroke();
        // Arrow head
        const angle = Math.atan2(d.y2 - d.y1, d.x2 - d.x1);
        const headlen = 14;
        ctx.beginPath();
        ctx.moveTo(d.x2, d.y2);
        ctx.lineTo(d.x2 - headlen * Math.cos(angle - Math.PI / 6), d.y2 - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(d.x2, d.y2);
        ctx.lineTo(d.x2 - headlen * Math.cos(angle + Math.PI / 6), d.y2 - headlen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
        break;
      }

      case 'text':
        ctx.font = `${d.fontSize || 20}px Plus Jakarta Sans, sans-serif`;
        ctx.fillStyle = d.fill || '#ffffff';
        ctx.fillText(d.text || '', d.x, d.y + (d.fontSize || 20));
        break;

      default:
        break;
    }

    // Highlight selected element bounding box
    if (isSelected) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      const bounds = getElementBounds(el);
      ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.width + 8, bounds.height + 8);
    }

    ctx.restore();
  };

  // Compute element bounding box for selection and hit-testing
  const getElementBounds = (el) => {
    const d = el.data || {};
    if (el.type === 'rectangle' || el.type === 'circle') {
      return {
        x: Math.min(d.x, d.x + (d.width || 0)),
        y: Math.min(d.y, d.y + (d.height || 0)),
        width: Math.abs(d.width || 0),
        height: Math.abs(d.height || 0)
      };
    }
    if (el.type === 'stroke' && Array.isArray(d.points) && d.points.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      d.points.forEach((p) => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    if (el.type === 'line' || el.type === 'arrow') {
      return {
        x: Math.min(d.x1, d.x2),
        y: Math.min(d.y1, d.y2),
        width: Math.abs(d.x2 - d.x1),
        height: Math.abs(d.y2 - d.y1)
      };
    }
    if (el.type === 'text') {
      return { x: d.x, y: d.y, width: 120, height: (d.fontSize || 20) + 8 };
    }
    return { x: 0, y: 0, width: 0, height: 0 };
  };

  // Hit test point against element
  const hitTest = (worldX, worldY) => {
    for (let i = elementOrder.length - 1; i >= 0; i--) {
      const id = elementOrder[i];
      const el = elements[id];
      if (!el) continue;
      const b = getElementBounds(el);
      const padding = 8;
      if (
        worldX >= b.x - padding &&
        worldX <= b.x + b.width + padding &&
        worldY >= b.y - padding &&
        worldY <= b.y + b.height + padding
      ) {
        return el;
      }
    }
    return null;
  };

  // Mouse Down Handler
  const handleMouseDown = (e) => {
    // Middle click or space down -> Pan
    if (e.button === 1 || e.spaceKey) {
      setIsPanning(true);
      setDragStartPos({ x: e.clientX, y: e.clientY });
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (activeTool === 'select') {
      const hit = hitTest(world.x, world.y);
      if (hit) {
        dispatch(setSelectedElementId(hit.id));
        setIsDraggingElement(true);
        setDragStartPos({ x: world.x, y: world.y });
        setInitialElementData(JSON.parse(JSON.stringify(hit.data)));
      } else {
        dispatch(setSelectedElementId(null));
      }
      return;
    }

    if (activeTool === 'eraser') {
      const hit = hitTest(world.x, world.y);
      if (hit) {
        dispatch(removeElement(hit.id));
        emitElementDelete(hit.id);
      }
      return;
    }

    if (activeTool === 'text') {
      const text = prompt('Enter text:');
      if (text && text.trim()) {
        const newEl = {
          id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          type: 'text',
          data: {
            x: world.x,
            y: world.y,
            text: text.trim(),
            fontSize: toolSettings.fontSize,
            fill: toolSettings.strokeColor
          },
          version: 1
        };
        dispatch(upsertElement(newEl));
        emitElementUpdate(newEl, true);
      }
      return;
    }

    // Drawing tool started
    setIsDrawing(true);
    const id = `el_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    if (activeTool === 'pencil') {
      currentShapeRef.current = {
        id,
        type: 'stroke',
        data: {
          points: [{ x: world.x, y: world.y }],
          stroke: toolSettings.strokeColor,
          strokeWidth: toolSettings.strokeWidth
        },
        version: 1
      };
    } else if (activeTool === 'rectangle' || activeTool === 'circle') {
      currentShapeRef.current = {
        id,
        type: activeTool,
        data: {
          x: world.x,
          y: world.y,
          width: 0,
          height: 0,
          stroke: toolSettings.strokeColor,
          fill: toolSettings.fillColor,
          strokeWidth: toolSettings.strokeWidth
        },
        version: 1
      };
    } else if (activeTool === 'line' || activeTool === 'arrow') {
      currentShapeRef.current = {
        id,
        type: activeTool,
        data: {
          x1: world.x,
          y1: world.y,
          x2: world.x,
          y2: world.y,
          stroke: toolSettings.strokeColor,
          strokeWidth: toolSettings.strokeWidth
        },
        version: 1
      };
    }
  };

  // Mouse Move Handler
  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    // Throttle cursor emit (every 40ms)
    const now = Date.now();
    if (now - lastCursorEmitRef.current > 40) {
      lastCursorEmitRef.current = now;
      emitCursorMove(world.x, world.y);
    }

    // Panning
    if (isPanning) {
      dispatch(
        setViewport({
          panX: viewport.panX + (e.clientX - dragStartPos.x),
          panY: viewport.panY + (e.clientY - dragStartPos.y)
        })
      );
      setDragStartPos({ x: e.clientX, y: e.clientY });
      return;
    }

    // Dragging selected element
    if (isDraggingElement && selectedElementId) {
      const dx = world.x - dragStartPos.x;
      const dy = world.y - dragStartPos.y;
      const el = elements[selectedElementId];
      if (!el) return;

      const updated = { ...el, data: { ...el.data } };
      if (el.type === 'rectangle' || el.type === 'circle' || el.type === 'text') {
        updated.data.x = (initialElementData.x || 0) + dx;
        updated.data.y = (initialElementData.y || 0) + dy;
      } else if (el.type === 'line' || el.type === 'arrow') {
        updated.data.x1 = (initialElementData.x1 || 0) + dx;
        updated.data.y1 = (initialElementData.y1 || 0) + dy;
        updated.data.x2 = (initialElementData.x2 || 0) + dx;
        updated.data.y2 = (initialElementData.y2 || 0) + dy;
      } else if (el.type === 'stroke' && Array.isArray(initialElementData.points)) {
        updated.data.points = initialElementData.points.map((p) => ({
          x: p.x + dx,
          y: p.y + dy
        }));
      }

      dispatch(upsertElement(updated));
      return;
    }

    // Drawing in-progress
    if (isDrawing && currentShapeRef.current) {
      const shape = currentShapeRef.current;
      if (shape.type === 'stroke') {
        shape.data.points.push({ x: world.x, y: world.y });
      } else if (shape.type === 'rectangle' || shape.type === 'circle') {
        shape.data.width = world.x - shape.data.x;
        shape.data.height = world.y - shape.data.y;
      } else if (shape.type === 'line' || shape.type === 'arrow') {
        shape.data.x2 = world.x;
        shape.data.y2 = world.y;
      }
    }
  };

  // Mouse Up Handler
  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isDraggingElement && selectedElementId) {
      setIsDraggingElement(false);
      const el = elements[selectedElementId];
      if (el) {
        emitElementUpdate(el, false, initialElementData);
      }
      setInitialElementData(null);
      return;
    }

    if (isDrawing && currentShapeRef.current) {
      const completedShape = currentShapeRef.current;
      currentShapeRef.current = null;
      setIsDrawing(false);

      // Validate non-trivial shape
      let valid = true;
      if (completedShape.type === 'stroke') {
        valid = completedShape.data.points.length > 1;
      } else if (completedShape.type === 'rectangle' || completedShape.type === 'circle') {
        valid = Math.abs(completedShape.data.width) > 3 || Math.abs(completedShape.data.height) > 3;
      }

      if (valid) {
        dispatch(upsertElement(completedShape));
        emitElementUpdate(completedShape, true);
      }
    }
  };

  // Wheel Zoom Handler
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newZoom = Math.min(Math.max(viewport.zoom * zoomFactor, 0.2), 4.0);

    // Zoom centered on cursor position
    const newPanX = mouseX - (mouseX - viewport.panX) * (newZoom / viewport.zoom);
    const newPanY = mouseY - (mouseY - viewport.panY) * (newZoom / viewport.zoom);

    dispatch(
      setViewport({
        zoom: newZoom,
        panX: newPanX,
        panY: newPanY
      })
    );
  };

  // Resize Canvas to Window
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [canvasRef]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementId) {
          dispatch(removeElement(selectedElementId));
          emitElementDelete(selectedElementId);
        }
      } else if (e.key.toLowerCase() === 'v') {
        dispatch(setActiveTool('select'));
      } else if (e.key.toLowerCase() === 'p') {
        dispatch(setActiveTool('pencil'));
      } else if (e.key.toLowerCase() === 'r') {
        dispatch(setActiveTool('rectangle'));
      } else if (e.key.toLowerCase() === 'o') {
        dispatch(setActiveTool('circle'));
      } else if (e.key.toLowerCase() === 't') {
        dispatch(setActiveTool('text'));
      } else if (e.key.toLowerCase() === 'e') {
        dispatch(setActiveTool('eraser'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, dispatch, emitElementDelete]);

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      style={{
        display: 'block',
        width: '100vw',
        height: '100vh',
        cursor:
          activeTool === 'select'
            ? isDraggingElement
              ? 'grabbing'
              : 'default'
            : activeTool === 'eraser'
            ? 'crosshair'
            : 'crosshair',
        touchAction: 'none'
      }}
    />
  );
};
