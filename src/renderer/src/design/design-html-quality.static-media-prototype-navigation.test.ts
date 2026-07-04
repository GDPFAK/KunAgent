import { describe, expect, it } from 'vitest'
import {
  auditDesignHtmlQuality,
  buildDesignHtmlQualityRepairPrompt,
  buildDesignRuntimeQualityAuditScript,
  clearDesignRuntimeQualityFindings,
  formatDesignHtmlQualityFindings,
  getDesignRuntimeQualityFindings,
  mergeDesignHtmlQualityFindings,
  normalizeRuntimeQualityFindings,
  setDesignRuntimeQualityFindings,
  shouldAutoRepairDesignHtmlFinding,
  summarizeDesignHtmlQualityDetails,
  summarizeDesignHtmlQualityStatus
} from './design-html-quality'

describe("auditDesignHtmlQuality document readiness and states0", () => {
    it('accepts named and decorative images', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><h1>Customer profile</h1>',
          '<img src=".kun-design/assets/customer.png" alt="Portrait of Mina Chen">',
          '<img src=".kun-design/assets/ring.png" alt="">',
          '<img src=".kun-design/assets/grid.png" role="presentation">',
          '<button>Review account</button><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).not.toContain('missing-image-source')
      expect(codes).not.toContain('missing-image-alt')
      expect(codes).not.toContain('generic-image-alt')
    })
    it('flags multi-screen pages that do not link to sibling screens', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><button>Start project</button><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join(''),
        siblingScreens: [
          { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' }
        ]
      })
  
      expect(findings.map((finding) => finding.code)).toContain('missing-prototype-navigation')
    })
    it('does not treat prototype paths in text or comments as clickable navigation', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><!-- next page ../home/v1.html --><main><h1>Vendor queue</h1>',
          '<p>Prototype should go to ../home/v1.html after approval.</p><button>Start project</button>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join(''),
        siblingScreens: [
          { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' }
        ]
      })
  
      expect(findings.map((finding) => finding.code)).toContain('missing-prototype-navigation')
    })
    it('flags multi-screen pages without a navigation landmark', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><h1>Vendor queue</h1><a href="../home/v1.html">Open overview</a>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join(''),
        siblingScreens: [
          { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' }
        ]
      })
  
      expect(findings.map((finding) => finding.code)).toContain('missing-navigation-landmark')
    })
    it('accepts prototype links to sibling screens', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><header><nav><a href="../home/v1.html">Home</a></nav></header>',
          '<main><a href="../settings/v1.html">Start project</a><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join(''),
        siblingScreens: [
          { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' }
        ]
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('missing-prototype-navigation')
      expect(findings.map((finding) => finding.code)).not.toContain('missing-navigation-landmark')
    })
    it('accepts prototype navigation attributes intercepted by the player', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>a:focus-visible,button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><header><nav><button data-prototype-target="../home/v1.html">Home</button><a data-target="../settings/v1.html">Settings</a></nav></header>',
          '<main><h1>Vendor queue</h1><button data-href="../home/v1.html">Open overview</button>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join(''),
        siblingScreens: [
          { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' },
          { name: 'Settings', htmlPath: '.kun-design/doc/settings/v1.html', prototypeHref: '../settings/v1.html' }
        ]
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).not.toContain('missing-prototype-navigation')
      expect(codes).not.toContain('weak-prototype-navigation-coverage')
      expect(codes).not.toContain('missing-navigation-landmark')
    })
    it('accepts explicit inline location prototype handlers intercepted by the player', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>a:focus-visible,button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><header><nav><a href="#" onclick="location.href = \'Home\'" aria-current="page">Home</a>',
          '<button onclick="window.location.assign(\'../settings/v1.html\')">Settings</button></nav></header>',
          '<main><h1>Vendor queue</h1><button onclick="location.replace(\'Settings\')">Review permissions</button>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join(''),
        siblingScreens: [
          { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' },
          { name: 'Settings', htmlPath: '.kun-design/doc/settings/v1.html', prototypeHref: '../settings/v1.html' }
        ]
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).not.toContain('dead-link-targets')
      expect(codes).not.toContain('missing-prototype-navigation')
      expect(codes).not.toContain('weak-prototype-navigation-coverage')
      expect(codes).not.toContain('missing-navigation-landmark')
      expect(codes).not.toContain('missing-navigation-current-state')
    })
    it('accepts scripted history prototype routes intercepted by the player', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>a:focus-visible,button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><header><nav><button onclick="history.replaceState({}, \'\', \'../home/v1.html\')" aria-current="page">Home</button>',
          '<button onclick="history.pushState({}, \'\', \'../settings/v1.html\')">Settings</button></nav></header>',
          '<main><h1>Vendor queue</h1><button onclick="window.history.pushState({}, \'\', \'Settings\')">Review permissions</button>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join(''),
        siblingScreens: [
          { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' },
          { name: 'Settings', htmlPath: '.kun-design/doc/settings/v1.html', prototypeHref: '../settings/v1.html' }
        ]
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).not.toContain('dead-link-targets')
      expect(codes).not.toContain('missing-prototype-navigation')
      expect(codes).not.toContain('weak-prototype-navigation-coverage')
      expect(codes).not.toContain('missing-navigation-landmark')
      expect(codes).not.toContain('missing-navigation-current-state')
    })
    it('counts form onsubmit prototype handlers as sibling navigation', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>a:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><header><nav><a href="../home/v1.html" aria-current="page">Home</a></nav></header>',
          '<main><h1>Create workspace</h1><form onsubmit="location.href = \'Settings\'"><label for="team">Team</label>',
          '<input id="team"><button type="submit">Create workspace</button></form>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join(''),
        siblingScreens: [
          { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' },
          { name: 'Settings', htmlPath: '.kun-design/doc/settings/v1.html', prototypeHref: '../settings/v1.html' }
        ]
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).not.toContain('inert-form-submission')
      expect(codes).not.toContain('missing-prototype-navigation')
      expect(codes).not.toContain('weak-prototype-navigation-coverage')
      expect(codes).not.toContain('missing-navigation-landmark')
    })
    it('counts inline location.hash prototype handlers as sibling navigation', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>a:focus-visible,button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><header><nav><a href="../home/v1.html" aria-current="page">Home</a>',
          '<button onclick="location.hash = \'#/settings\'">Settings</button></nav></header>',
          '<main><h1>Vendor queue</h1><button onclick="location.hash = \'#/weekly-stats\'">Review stats</button>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join(''),
        siblingScreens: [
          { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' },
          { name: 'Settings', htmlPath: '.kun-design/doc/settings/v1.html', prototypeHref: '../settings/v1.html' },
          { name: 'Weekly Stats', htmlPath: '.kun-design/doc/weekly-stats/v1.html', prototypeHref: '../weekly-stats/v1.html' }
        ]
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).not.toContain('missing-prototype-navigation')
      expect(codes).not.toContain('weak-prototype-navigation-coverage')
      expect(codes).not.toContain('missing-navigation-landmark')
      expect(codes).not.toContain('missing-navigation-current-state')
    })
    it('accepts page-title prototype targets intercepted by the player', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>a:focus-visible,button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><header><nav><button data-prototype-target=" Home ">Home</button><button data-target="settings">Settings</button></nav></header>',
          '<main><h1>Vendor queue</h1><button data-prototype-target="Settings">Review permissions</button>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join(''),
        siblingScreens: [
          { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' },
          { name: 'Settings', htmlPath: '.kun-design/doc/settings/v1.html', prototypeHref: '../settings/v1.html' }
        ]
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).not.toContain('missing-prototype-navigation')
      expect(codes).not.toContain('weak-prototype-navigation-coverage')
      expect(codes).not.toContain('missing-navigation-landmark')
    })
    it('does not accept duplicate page-title prototype targets as resolved navigation', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><header><nav><button data-prototype-target="Settings">Settings</button></nav></header>',
          '<main><h1>Vendor queue</h1><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join(''),
        siblingScreens: [
          { name: 'Settings', htmlPath: '.kun-design/doc/account-settings/v1.html', prototypeHref: '../account-settings/v1.html' },
          { name: 'Settings', htmlPath: '.kun-design/doc/project-settings/v1.html', prototypeHref: '../project-settings/v1.html' }
        ]
      })
  
      expect(findings.map((finding) => finding.code)).toContain('missing-prototype-navigation')
    })
    it('accepts unique route-style prototype href slugs that the player can resolve', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>a:focus-visible,button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><header><nav><a href="/settings">Settings</a><button data-href="../weekly-stats/">Stats</button></nav></header>',
          '<main><h1>Vendor queue</h1><button data-prototype-target="../account-settings/">Review permissions</button>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join(''),
        siblingScreens: [
          { name: 'Account Settings', htmlPath: '.kun-design/doc/account-settings/v1.html', prototypeHref: '../account-settings/v1.html' },
          { name: 'Weekly Stats', htmlPath: '.kun-design/doc/weekly-stats/v1.html', prototypeHref: '../weekly-stats/v1.html' }
        ]
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).not.toContain('missing-prototype-navigation')
      expect(codes).not.toContain('weak-prototype-navigation-coverage')
    })
    it('accepts hash-route prototype hrefs that the player can resolve', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>.current{font-weight:700}a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><header><nav><a href="#/account-settings" aria-current="page" class="current">Settings</a><a href="#!/weekly-stats">Stats</a></nav></header>',
          '<main><h1>Vendor queue</h1><a href="#..%2Fweekly-stats%2Fv1.html">Review stats</a>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join(''),
        siblingScreens: [
          { name: 'Account Settings', htmlPath: '.kun-design/doc/account-settings/v1.html', prototypeHref: '../account-settings/v1.html' },
          { name: 'Weekly Stats', htmlPath: '.kun-design/doc/weekly-stats/v1.html', prototypeHref: '../weekly-stats/v1.html' }
        ]
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).not.toContain('dead-link-targets')
      expect(codes).not.toContain('missing-prototype-navigation')
      expect(codes).not.toContain('weak-prototype-navigation-coverage')
      expect(codes).not.toContain('missing-navigation-landmark')
    })
    it('does not accept ambiguous route-style prototype href slugs as resolved navigation', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><header><nav><a href="/settings">Settings</a></nav></header>',
          '<main><h1>Vendor queue</h1><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join(''),
        siblingScreens: [
          { name: 'Account Settings', htmlPath: '.kun-design/doc/account-settings/v1.html', prototypeHref: '../account-settings/v1.html' },
          { name: 'Project Settings', htmlPath: '.kun-design/doc/project-settings/v1.html', prototypeHref: '../project-settings/v1.html' }
        ]
      })
  
      expect(findings.map((finding) => finding.code)).toContain('missing-prototype-navigation')
    })
    it('flags multi-screen projects that link to only one sibling screen', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>.current{font-weight:700}a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><header><nav><a href="../home/v1.html" aria-current="page" class="current">Home</a></nav></header>',
          '<main><h1>Vendor queue</h1><a href="../home/v1.html">Back to overview</a>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join(''),
        siblingScreens: [
          { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' },
          { name: 'Settings', htmlPath: '.kun-design/doc/settings/v1.html', prototypeHref: '../settings/v1.html' },
          { name: 'Reports', htmlPath: '.kun-design/doc/reports/v1.html', prototypeHref: '../reports/v1.html' }
        ]
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).not.toContain('missing-prototype-navigation')
      expect(codes).toContain('weak-prototype-navigation-coverage')
    })
    it('accepts multi-screen projects that link to multiple sibling screens', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>.current{font-weight:700}a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><header><nav><a href="../home/v1.html" aria-current="page" class="current">Home</a><a href="../settings/v1.html">Settings</a><a href="../reports/v1.html">Reports</a></nav></header>',
          '<main><h1>Vendor queue</h1><a href="../settings/v1.html">Review permissions</a>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join(''),
        siblingScreens: [
          { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' },
          { name: 'Settings', htmlPath: '.kun-design/doc/settings/v1.html', prototypeHref: '../settings/v1.html' },
          { name: 'Reports', htmlPath: '.kun-design/doc/reports/v1.html', prototypeHref: '../reports/v1.html' }
        ]
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('weak-prototype-navigation-coverage')
    })
    it('flags multi-screen navigation without a current-page state', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><header><nav><a href="../home/v1.html">Home</a><a href="../settings/v1.html">Settings</a></nav></header>',
          '<main><h1>Vendor queue</h1><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join(''),
        siblingScreens: [
          { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' },
          { name: 'Settings', htmlPath: '.kun-design/doc/settings/v1.html', prototypeHref: '../settings/v1.html' }
        ]
      })
  
      expect(findings.map((finding) => finding.code)).toContain('missing-navigation-current-state')
    })
    it('flags button-style prototype navigation without a current-page state', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><header><nav><button data-href="../home/v1.html">Home</button><button data-prototype-href="../settings/v1.html">Settings</button></nav></header>',
          '<main><h1>Vendor queue</h1><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join(''),
        siblingScreens: [
          { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' },
          { name: 'Settings', htmlPath: '.kun-design/doc/settings/v1.html', prototypeHref: '../settings/v1.html' }
        ]
      })
  
      expect(findings.map((finding) => finding.code)).toContain('missing-navigation-current-state')
    })
    it('accepts multi-screen navigation with a visible or accessible current-page state', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>.current{font-weight:700}a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><header><nav><a href="../home/v1.html" aria-current="page" class="current">Home</a><a href="../settings/v1.html">Settings</a></nav></header>',
          '<main><h1>Vendor queue</h1><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join(''),
        siblingScreens: [
          { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' },
          { name: 'Settings', htmlPath: '.kun-design/doc/settings/v1.html', prototypeHref: '../settings/v1.html' }
        ]
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('missing-navigation-current-state')
    })
    it('accepts role navigation landmarks in multi-screen pages', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><header role="navigation"><a href="../home/v1.html">Home</a></header>',
          '<main><h1>Vendor queue</h1><a href="../settings/v1.html">Start review</a>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join(''),
        siblingScreens: [
          { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' }
        ]
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('missing-navigation-landmark')
    })
})
