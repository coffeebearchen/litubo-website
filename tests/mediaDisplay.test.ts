/**
 * ML-CLOUD-03 — the fallback a card shows when it cannot show a picture.
 *
 * The visual rule this protects is that a broken thumbnail must render the
 * SAME stable block a non-image renders, rather than a broken-image glyph with
 * alt text spilling over the filename. That means the mapping has to answer
 * for every format the library accepts — and for the ones it does not, since a
 * file uploaded before a rule changed still has to draw.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileKind, summariseUpload, systemFolderLabel, folderSection, folderBadge, directChildFolders } from '../utils/mediaDisplay'

describe('the label shown when there is no thumbnail', () => {
  it.each([
    ['application/pdf', 'PDF'],
    ['image/jpeg', 'IMAGE'],
    ['image/png', 'IMAGE'],
    ['image/webp', 'IMAGE'],
    ['text/csv', 'CSV'],
    ['text/tab-separated-values', 'TSV'],
    ['text/plain', 'TXT'],
  ])('%s → %s', (type, expected) => {
    expect(fileKind(type)).toBe(expected)
  })

  it('reads a content type that carries a charset parameter', () => {
    expect(fileKind('text/csv; charset=utf-8')).toBe('CSV')
    expect(fileKind('text/plain;charset=UTF-8')).toBe('TXT')
  })

  it('is case-insensitive, because stored types are not normalised', () => {
    expect(fileKind('IMAGE/JPEG')).toBe('IMAGE')
    expect(fileKind('Application/PDF')).toBe('PDF')
  })

  /** A card with an unknown or missing type still has to draw something. */
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['whitespace', '   '],
    ['a format the library does not accept', 'application/vnd.ms-excel'],
    ['nonsense', 'not-a-mime-type'],
  ])('falls back to FILE for %s', (_label, type) => {
    expect(fileKind(type)).toBe('FILE')
  })

  it('distinguishes TSV from plain text, which share a prefix', () => {
    expect(fileKind('text/tab-separated-values')).toBe('TSV')
    expect(fileKind('text/plain')).toBe('TXT')
  })
})

describe('reporting how an upload batch went', () => {
  const ok = (filename: string) => ({ filename, ok: true })
  const bad = (filename: string, message: string) => ({ filename, ok: false, message })

  it('says nothing happened for an empty batch', () => {
    expect(summariseUpload([])).toBe('Nothing to upload')
  })

  it('reports a clean batch as a success', () => {
    expect(summariseUpload([ok('a.pdf'), ok('b.pdf')])).toBe('2 file(s) uploaded successfully')
  })

  it('reports a batch that entirely failed as a failure', () => {
    expect(summariseUpload([bad('a.exe', 'Unsupported format')])).toBe('1 file(s) failed to upload')
  })

  /**
   * The case the old single-message banner got wrong in both directions:
   * "Upload failed" hid four files that landed, "success" hid the one that
   * did not.
   */
  it('reports a partly failed batch as both numbers', () => {
    const results = [ok('a.pdf'), ok('b.pdf'), ok('c.pdf'), ok('d.pdf'), bad('e.exe', 'Unsupported format')]
    expect(summariseUpload(results)).toBe('4 uploaded, 1 failed')
  })
})

/**
 * ML-CLOUD-UI-CLEANUP-01 — system folders are stored as governance slugs, and
 * governance matches on the stored name by exact path. The label is a display
 * transform only, so it has to be a pure function of the name with no aliases
 * that could drift away from what is actually stored.
 */
describe('how a system folder name is displayed', () => {
  it.each([
    ['products', 'Products'],
    ['resources', 'Resources'],
    ['metal-detection', 'Metal Detection'],
    ['technical-docs', 'Technical Docs'],
    ['case-studies', 'Case Studies'],
  ])('%s → %s', (stored, shown) => {
    expect(systemFolderLabel(stored)).toBe(shown)
  })

  it('leaves an already-capitalised name alone', () => {
    expect(systemFolderLabel('Products')).toBe('Products')
  })

  /**
   * `xray` becomes "Xray", not "X-ray". Inventing a nicer label would mean
   * keeping an alias table in step with folder names nobody remembers it
   * depends on — the moment they disagree, the screen lies about the folder.
   */
  it('does not invent a prettier name than the folder actually has', () => {
    expect(systemFolderLabel('xray')).toBe('Xray')
  })

  it('collapses repeated separators rather than emitting blanks', () => {
    expect(systemFolderLabel('a--b')).toBe('A B')
    expect(systemFolderLabel('  spaced  out  ')).toBe('Spaced Out')
  })

  it('survives an empty name', () => {
    expect(systemFolderLabel('')).toBe('')
  })
})

/**
 * ML-CLOUD-MOBILE-VISUAL-ALIGN-01 — which section a folder is listed under,
 * and what it is allowed to say about itself.
 *
 * The mobile navigation is the first place a person reads a folder's status,
 * so the rule that decides it has to be checkable without a browser. These
 * assert the two things that would actually hurt someone if they broke: a
 * folder appearing in the wrong group, and a frozen folder rendering as if it
 * were ordinary.
 */
describe('which navigation section a folder belongs to', () => {
  const folder = (
    depth: number,
    management: 'protected' | 'customer-managed' | 'locked',
    policy_state = 'active-canonical',
  ) => ({ depth, management, policy_state })

  it('a customer-managed folder is a Customer folder, at any depth', () => {
    expect(folderSection(folder(1, 'customer-managed'))).toBe('customer')
    expect(folderSection(folder(4, 'customer-managed'))).toBe('customer')
  })

  it('a healthy top-level system folder is a Quick access shortcut', () => {
    expect(folderSection(folder(0, 'protected'))).toBe('quick-access')
    expect(folderSection(folder(0, 'protected', 'container-only'))).toBe('quick-access')
  })

  it('a healthy system folder below the top level is a System folder', () => {
    expect(folderSection(folder(1, 'protected'))).toBe('system')
    expect(folderSection(folder(2, 'protected'))).toBe('system')
  })

  it.each([
    ['legacy', 'legacy-read-only'],
    ['a naming conflict', 'conflict-frozen'],
    ['ambiguous', 'ambiguous'],
    ['unknown', 'unknown'],
  ])('a locked folder (%s) is a Protected folder', (_label, state) => {
    expect(folderSection(folder(1, 'locked', state))).toBe('protected')
  })

  /**
   * The safety rule from the work order: a shortcut may not launder a folder's
   * status. A frozen folder that happens to sit at the top level is NOT
   * promoted into Quick access, where it would sit beside ordinary folders.
   */
  it('a frozen top-level folder is never promoted into Quick access', () => {
    expect(folderSection(folder(0, 'locked', 'conflict-frozen'))).toBe('protected')
    expect(folderSection(folder(0, 'locked', 'legacy-read-only'))).toBe('protected')
  })

  /**
   * The real tree as the server returns it. The four sections have to partition
   * it: list a folder twice and a phone screen repeats itself; list it zero
   * times and the folder becomes unreachable from the navigation.
   */
  it('partitions the real folder tree — every folder in exactly one section', () => {
    const tree = [
      folder(0, 'protected'), // applications
      folder(0, 'locked', 'conflict-frozen'), // certifications
      folder(0, 'protected'), // company
      folder(1, 'locked', 'legacy-read-only'), // company/global-service
      folder(0, 'protected'), // home
      folder(0, 'protected', 'container-only'), // products
      folder(1, 'protected'), // products/checkweigher
      folder(2, 'customer-managed'), // …/LT180C AI BETA TEST ONLY
      folder(1, 'protected'), // products/combination
      folder(1, 'protected'), // products/conveyor
      folder(2, 'customer-managed'), // …/ZZ-ML-CLOUD-01 TEST ONLY
      folder(3, 'customer-managed'),
      folder(3, 'customer-managed'),
      folder(3, 'customer-managed'),
      folder(3, 'customer-managed'), // …/manuals
      folder(1, 'protected'), // products/metal-detection
      folder(1, 'locked', 'legacy-read-only'), // products/technical-docs
      folder(1, 'protected'), // products/xray
      folder(0, 'protected', 'container-only'), // resources
      folder(1, 'locked', 'legacy-read-only'), // resources/case-studies
      folder(1, 'locked', 'legacy-read-only'), // resources/downloads
      folder(1, 'locked', 'legacy-read-only'), // resources/insights
    ]
    const counts = { 'quick-access': 0, customer: 0, system: 0, protected: 0 }
    for (const f of tree) counts[folderSection(f)] += 1

    expect(counts).toEqual({ 'quick-access': 5, customer: 6, system: 5, protected: 6 })
    // Nothing lost, nothing duplicated.
    expect(counts['quick-access'] + counts.customer + counts.system + counts.protected).toBe(tree.length)
  })
})

describe('what a folder row is allowed to say about itself', () => {
  const folder = (
    management: 'protected' | 'customer-managed' | 'locked',
    policy_state: string,
  ) => ({ depth: 1, management, policy_state })

  it('a naming conflict says Conflict', () => {
    expect(folderBadge(folder('locked', 'conflict-frozen'))).toBe('Conflict')
  })

  /** Two folder UUIDs resolving to one path is a conflict, not a read-only state. */
  it('an ambiguous path says Conflict too', () => {
    expect(folderBadge(folder('locked', 'ambiguous'))).toBe('Conflict')
  })

  it('a legacy folder says Read only', () => {
    expect(folderBadge(folder('locked', 'legacy-read-only'))).toBe('Read only')
  })

  /** Fail-closed but with nothing more specific to report. */
  it('an unknown folder says only Protected', () => {
    expect(folderBadge(folder('locked', 'unknown'))).toBe('Protected')
  })

  it.each([
    ['a healthy system folder', 'protected', 'active-canonical'],
    ['a container', 'protected', 'container-only'],
    ['a customer folder', 'customer-managed', 'active-canonical'],
  ])('%s carries no badge', (_label, management, state) => {
    expect(folderBadge(folder(management as 'protected' | 'customer-managed', state))).toBeNull()
  })

  /**
   * The badge is a pure function of state, so the SAME folder shows the same
   * badge wherever it is drawn. Quick access cannot quietly drop it.
   */
  it('does not depend on where the row is drawn', () => {
    const frozen = { management: 'locked' as const, policy_state: 'conflict-frozen' }
    expect(folderBadge({ ...frozen, depth: 0 })).toBe('Conflict')
    expect(folderBadge({ ...frozen, depth: 3 })).toBe('Conflict')
  })
})

/**
 * The page wiring. `pages/admin/media/index.vue` awaits `useFetch` at setup
 * top level, so it cannot be mounted in isolation; this repo's established
 * pattern for asserting that page's markup is to read the source (see
 * `tests/mediaUploadTypes.test.ts`).
 *
 * These check the promises the work order makes to the operator, not styling.
 */
describe('the Media Library navigation is wired to those rules', () => {
  const source = readFileSync(resolve(process.cwd(), 'pages/admin/media/index.vue'), 'utf8')

  it('builds all four sections from folderSection(), not from ad-hoc filters', () => {
    for (const group of ['quick-access', 'customer', 'system', 'protected']) {
      expect(source).toContain(`folderSection(f) === '${group}'`)
    }
  })

  it('opens Quick access and leaves the other three closed', () => {
    expect(source).toContain('const quickAccessOpen = ref(true)')
    expect(source).toContain('const customerFoldersOpen = ref(false)')
    expect(source).toContain('const systemFoldersOpen = ref(false)')
    expect(source).toContain('const protectedFoldersOpen = ref(false)')
  })

  /** Four phone sections plus the desktop sidebar's own System folders disclosure. */
  it('every section head reports its state to assistive technology', () => {
    expect(source.match(/:aria-expanded="(quickAccess|customerFolders|systemFolders|protectedFolders)Open"/g) ?? [])
      .toHaveLength(5)
  })

  /**
   * Open/closed is a browser-only preference. Persisting it would make one
   * person's phone habit change what the next person sees, and would put a
   * presentation detail into folder data.
   */
  it('never persists open/closed state', () => {
    for (const persisted of ['localStorage', 'sessionStorage', 'useCookie']) {
      expect(source).not.toContain(persisted)
    }
  })

  it('renders every row from the same badge rule rather than inlining status strings', () => {
    expect(source).toContain('folderBadge(f)')
    // The pre-existing inline ternary that hard-coded these two labels is gone.
    expect(source).not.toContain("policy_state === 'conflict-frozen' ? 'Conflict' : 'Read only'")
  })
})

/**
 * ML-CLOUD-MOBILE-VISUAL-ALIGN-01 closeout — the phone hierarchy stays on the
 * phone.
 *
 * The first cut of this module rendered the four sections at every width, which
 * renamed the desktop sidebar's "Folders" heading to "Quick access" and added
 * two disclosures the sealed 1440px workspace never had. That is a desktop
 * redesign, and this module was only ever authorised to change 375px.
 *
 * The sidebar now holds two presentations of ONE classification: the sealed V1
 * markup, and the phone hierarchy. These tests are the guard that the second
 * never leaks into the first — they check the structural facts a reader of the
 * desktop sidebar would notice, not styling.
 */
describe('the sealed desktop sidebar is left alone', () => {
  const source = readFileSync(resolve(process.cwd(), 'pages/admin/media/index.vue'), 'utf8')
  /** Comments are not rendered, so they are stripped before asserting on what a block shows. */
  const between = (open: string, close: string) => {
    const start = source.indexOf(open)
    expect(start).toBeGreaterThan(-1)
    return source.slice(start, source.indexOf(close, start)).replace(/<!--[\s\S]*?-->/g, '')
  }
  const desktopNav = () => between('<div class="ml-nav ml-nav--desktop">', '<div class="ml-nav ml-nav--mobile">')
  const mobileNav = () => between('<div class="ml-nav ml-nav--mobile">', '</aside>')

  it('keeps the V1 headings — Library, Folders, System — not the phone ones', () => {
    const nav = desktopNav()
    expect(nav).toContain('<p class="sidebar-section-label">Library</p>')
    expect(nav).toContain('<p class="sidebar-section-label">Folders</p>')
    expect(nav).toContain('<p class="sidebar-section-label">System</p>')
    expect(nav).toContain('System folders')
  })

  /** The four-section vocabulary is what the reviewer saw leak onto 1440px. */
  it.each(['Quick access', 'Customer folders', 'Protected folders', 'Your main folders'])(
    'does not show the phone heading %s',
    (heading) => {
      expect(desktopNav()).not.toContain(heading)
      expect(mobileNav()).toContain(heading)
    },
  )

  it('renders rows as V1 nav items, and the phone card markup only on the phone', () => {
    const desktop = desktopNav()
    expect(desktop).toContain('class="nav-item"')
    expect(desktop).toContain('nav-item--sub')
    expect(desktop).toContain('nav-item__tag')
    for (const phoneOnly of ['nav-section', 'folder-row', 'file-state']) {
      expect(desktop).not.toContain(phoneOnly)
      expect(mobileNav()).toContain(phoneOnly)
    }
  })

  /**
   * Two presentations, one classification. If the desktop went back to its own
   * filters we would have two rules to keep in step, and they would drift.
   */
  it('is built from the same computeds as the phone, not a second set of filters', () => {
    const desktop = desktopNav()
    expect(desktop).toContain('v-for="f in quickAccessFolders"')
    expect(desktop).toContain('v-for="f in protectedFolders"')
    expect(desktop).toContain('folderBadge(f)')
    // The pre-module `sidebarRoots` / frozen-only `systemFolders` filters are gone.
    expect(source).not.toContain('sidebarRoots')
  })

  it('swaps the two blocks by width and shows the desktop one by default', () => {
    expect(source).toContain('.ml-nav--mobile { display: none;')
    expect(source).toContain('.ml-nav--desktop { display: none; }')
    expect(source).toContain('.ml-nav--mobile { display: flex; }')
  })
})

/**
 * ML-CLOUD-MOBILE-VISUAL-ALIGN-01-R1 — the navigation shows one level at a
 * time.
 *
 * The library's shape is Products → Category → Model → Subfolder → Files, and
 * the navigation has to agree with it. The first cut listed every
 * customer-managed folder in one section regardless of depth, so a model's
 * folder and its own `manuals` appeared as siblings — a second, flattened tree
 * that contradicts the real one and hides each row's parent.
 */
describe('a folder listing shows direct children only', () => {
  /** products → checkweigher → LT180C → {manuals, specifications, photos} */
  const tree = [
    { id: 'products', depth: 0 },
    { id: 'checkweigher', depth: 1 },
    { id: 'lt180c', depth: 2 },
    { id: 'manuals', depth: 3 },
    { id: 'specifications', depth: 3 },
    { id: 'photos', depth: 3 },
    { id: 'lt200c', depth: 2 },
    { id: 'old-versions', depth: 3 },
    { id: 'resources', depth: 0 },
  ]
  const parentOf: Record<string, string | null> = {
    products: null,
    checkweigher: 'products',
    lt180c: 'checkweigher',
    manuals: 'lt180c',
    specifications: 'lt180c',
    photos: 'lt180c',
    lt200c: 'checkweigher',
    'old-versions': 'lt200c',
    resources: null,
  }
  const idsAt = (context: string | null) => directChildFolders(tree, parentOf, context).map(f => f.id)

  it('lists the top-level folders at the root, and nothing deeper', () => {
    expect(idsAt(null)).toEqual(['products', 'resources'])
  })

  it.each([
    ['products', ['checkweigher']],
    ['checkweigher', ['lt180c', 'lt200c']],
    ['lt180c', ['manuals', 'specifications', 'photos']],
  ])('inside %s, lists only its own children', (context, expected) => {
    expect(idsAt(context)).toEqual(expected)
  })

  /**
   * The exact shape the work order forbids: a model's subfolders must never
   * surface beside the model itself.
   */
  it('never pulls a grandchild up beside its parent', () => {
    const atCategory = idsAt('checkweigher')
    for (const grandchild of ['manuals', 'specifications', 'photos', 'old-versions']) {
      expect(atCategory).not.toContain(grandchild)
    }
  })

  it('never collects folders from unrelated branches', () => {
    expect(idsAt('lt180c')).not.toContain('old-versions')
    expect(idsAt('lt200c')).toEqual(['old-versions'])
  })

  it('a folder with no subfolders lists nothing, rather than falling back to the tree', () => {
    expect(idsAt('manuals')).toEqual([])
  })
})

describe('the Media Library navigation follows the real hierarchy', () => {
  const source = readFileSync(resolve(process.cwd(), 'pages/admin/media/index.vue'), 'utf8')

  it('scopes the governance sections to the current location, not the whole tree', () => {
    expect(source).toContain('directChildFolders(flatFolders.value, parentMap.value, context)')
    for (const list of ['navCustomerFolders', 'navSystemFolders', 'navProtectedFolders']) {
      expect(source).toContain(`const ${list} = computed(() => navChildren.value.filter(`)
      expect(source).toContain(`v-for="f in ${list}"`)
    }
  })

  /**
   * An empty heading kept only to match the sample data in the visual master
   * would be a claim about this library that is not true.
   */
  it('renders a governance section only when it actually has folders', () => {
    for (const list of ['navCustomerFolders', 'navSystemFolders', 'navProtectedFolders']) {
      expect(source).toContain(`<section v-if="${list}.length > 0" class="nav-section">`)
    }
  })

  it('hides the root sections once a folder is open', () => {
    expect(source).toContain('<template v-if="!inFolderView">')
    expect(source).toMatch(/const inFolderView = computed\(\(\) =>\s*\n\s*selectedFolder\.value !== null && selectedFolder\.value !== 'root' && !showArchivedView\.value,/)
  })

  /**
   * "Unclassified" is the files that have no folder yet. Uploading into it
   * means uploading with no folder at all, which would make "leave this unfiled"
   * the easiest path in the interface — the opposite of what the view is for.
   */
  it('refuses Unclassified as an upload destination and says why', () => {
    expect(source).toContain("if (id === 'root') return false")
    expect(source).toContain('Unclassified lists files that have no folder yet. Open a folder to upload.')
    expect(source).not.toContain("if (id === 'root') return true")
  })

  /** R1 defers real folder-tree upload; nothing here may grow that capability. */
  it('does not add recursive or tree-preserving folder upload', () => {
    // Exactly one input picks a local folder, and it imports flat — no tree is rebuilt.
    expect(source.match(/<input\b[^>]*webkitdirectory[^>]*>/g) ?? []).toHaveLength(1)
    /*
      Comments are stripped first: explaining that the flattening is deliberate
      means naming the API being ignored, and that prose is not an implementation.
    */
    const code = source.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    for (const recursive of ['webkitRelativePath', 'fullPath', 'createReader']) {
      expect(code).not.toContain(recursive)
    }
  })
})

/**
 * ML-CLOUD-MOBILE-VISUAL-ALIGN-01-R2 — the phone UX closeout.
 *
 * Three small things, each of which was telling the operator something untrue:
 * a filter offered where it cannot apply, an action named for less than it
 * does, and a card shape that hid the only thing identifying a document.
 */
describe('the phone Media Library says only true things', () => {
  const source = readFileSync(resolve(process.cwd(), 'pages/admin/media/index.vue'), 'utf8')
  const mobileNav = () => {
    const start = source.indexOf('<div class="ml-nav ml-nav--mobile">')
    return source.slice(start, source.indexOf('</aside>', start))
  }

  /**
   * "Unclassified" is the files that are in NO folder, so inside a folder it
   * can never match anything. Leaving it there offered a tap that silently
   * abandons the folder the operator had navigated into.
   */
  it('drops Unclassified from the file-state control once a folder is open', () => {
    const nav = mobileNav()
    const unclassified = nav.slice(nav.indexOf('<button'), nav.indexOf('>Unclassified</button>'))
    const guarded = nav.slice(0, nav.indexOf('>Unclassified</button>'))
    expect(guarded).toContain('v-if="!inFolderView"')
    expect(unclassified).toBeTruthy()
  })

  it('keeps All files and Archived reachable from inside a folder', () => {
    const nav = mobileNav()
    for (const label of ['>All files</button>', '>Archived</button>']) {
      const upTo = nav.slice(0, nav.indexOf(label))
      // The guard belongs to Unclassified alone — it must not have swallowed its neighbours.
      expect(upTo.lastIndexOf('v-if="!inFolderView"')).toBeLessThan(upTo.lastIndexOf('<button'))
    }
  })

  /**
   * The old label promised less than the action delivers in both directions:
   * `webkitdirectory` returns subfolder files too, and every one of them is
   * uploaded into the current folder with its path discarded.
   */
  it('says what the folder upload actually reaches and what it discards', () => {
    expect(source).toContain('Upload files from a folder')
    expect(source).toMatch(/subfolders included/i)
    expect(source).toMatch(/folder structure is not recreated/i)
    // The wording that described it as just "the files inside a folder".
    expect(source).not.toContain('Imports the files inside a folder on your computer')
    expect(source).not.toContain('Upload folder contents')
  })

  /**
   * A document card carries a name, not a picture. Half a phone width spent
   * 120px of height on a kind chip and then clipped the filename across two
   * lines — so documents take the full row, and images keep the grid.
   */
  it('gives document cards the full row on a phone, and leaves image cards gridded', () => {
    expect(source).toContain("'file-card--doc': !isImage(f.type),")
    expect(source).toMatch(/\.file-card--doc \{[^}]*grid-column: 1 \/ -1;/)
    expect(source).toMatch(/\.file-card--doc \{[^}]*flex-direction: row;/)
    // Still two columns for everything that is not a document.
    expect(source).toContain('.file-grid { grid-template-columns: repeat(2, minmax(0, 1fr));')
  })

  it('scopes the full-width document card to phone widths only', () => {
    const mobileBlock = source.slice(source.indexOf('@media (max-width: 767px) {'))
    expect(mobileBlock).toContain('.file-card--doc {')
    const beforeMobile = source.slice(0, source.indexOf('@media (max-width: 767px) {'))
    expect(beforeMobile).not.toContain('.file-card--doc {')
  })
})
