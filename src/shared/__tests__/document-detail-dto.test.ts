import { describe, expect, it } from 'vitest'
import type { DocumentDetailDto } from '@shared/types'

describe('DocumentDetailDto type', () => {
  it('should include project_name and folder_name fields (compile-time check)', () => {
    // This test verifies at compile time that DocumentDetailDto includes the
    // project_name and folder_name fields. If the type does not have these
    // fields, TypeScript compilation will fail.
    const dto: DocumentDetailDto = {
      id: 1,
      name: 'test.pdf',
      file_path: '/files/test.pdf',
      file_type: 'pdf',
      file_size: 1024,
      folder_id: 1,
      project_id: 1,
      processing_status: 'completed',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      content: null,
      project_name: 'My Project',
      folder_name: 'My Folder',
    }

    expect(dto.project_name).toBe('My Project')
    expect(dto.folder_name).toBe('My Folder')
  })
})
