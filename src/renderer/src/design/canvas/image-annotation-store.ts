import { create } from 'zustand'

/**
 * UI-only bridge between the canvas (where the user double-clicks a filled image
 * to annotate it) and the full-screen `ImageAnnotationEditor` mounted up in the
 * workbench design route. Holds just the shape id being annotated; the editor
 * resolves the shape + its picture from the canvas stores. Kept separate from
 * the heavy design/workspace stores so the trigger has no other coupling.
 */
type ImageAnnotationState = {
  /** Shape id currently open in the annotation editor, or null when closed. */
  editingShapeId: string | null
  openImageAnnotation: (shapeId: string) => void
  closeImageAnnotation: () => void
}

export const useImageAnnotationStore = create<ImageAnnotationState>((set) => ({
  editingShapeId: null,
  openImageAnnotation: (shapeId) => set({ editingShapeId: shapeId }),
  closeImageAnnotation: () => set({ editingShapeId: null })
}))
