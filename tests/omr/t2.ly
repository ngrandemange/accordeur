\version "2.24.0"
#(set-global-staff-size 24)
\paper { indent = 0  paper-width = 190\mm  paper-height = 120\mm  top-margin=10\mm bottom-margin=10\mm left-margin=10\mm right-margin=10\mm }
\header { tagline = ##f }
\score { \new Staff { \clef alto \key d \major \time 4/4
  d'4. e'8 fis'4 r4 | g'4 gis'4 a'4 r8 b'8 | cis''4 c''4 d''2 \break
  r2 r4 r8 e''8 | fis''16 g''16 r16 a''16 b'4 r4 | d'1 \bar "|." }
  \layout { \context { \Score \remove "Bar_number_engraver" } } }
