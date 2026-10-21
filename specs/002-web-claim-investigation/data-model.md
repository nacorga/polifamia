# Data Model — 002

Cambios sobre `specs/001-youtube-claim-investigation/data-model.md`. El resto no cambia.

## investigations

| Campo | Tipo | Regla |
|---|---|---|
| `manual_origin` | `text` enum `['web_selection']`, nullable | solo si `manual_text` no es null; `null` = texto pegado. No se serializa. |

La restricción `investigations_claim_xor_manual` no cambia: una selección que coincide con el catálogo se guarda con
`claim_id` (y `manual_origin` null); sin coincidencia, con `manual_text` + `manual_origin = 'web_selection'`.

## Enums

- `event_name` += `selection_investigated`
- `failure_reason` += `not_checkable`
- `ErrorCode` (solo contrato) += `not_checkable`

## Selección en el navegador (no persistida en el servicio)

`storage.session['selection:<tabId>']`:

| Campo | Regla |
|---|---|
| `text` | `info.selectionText` recortado; el usuario puede editarlo (10..500 al enviar) |
| `url` | `origin + pathname` de `info.pageUrl`; solo http/https; sin query ni fragmento |
| `domain` | `hostname` sin `www.` |
| `title` | `tab.title` (vía `activeTab`) o vacío |
| `at` | ISO timestamp del clic |

Ciclo de vida: se escribe en el clic, se sobrescribe con una nueva selección en la misma pestaña, se borra al enviar o
cancelar y desaparece al cerrar el navegador.
