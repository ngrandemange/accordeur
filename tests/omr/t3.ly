\version "2.24.0"
#(set-global-staff-size 24)
\paper { indent = 0  paper-width = 190\mm  paper-height = 120\mm  top-margin=10\mm bottom-margin=10\mm left-margin=10\mm right-margin=10\mm }
\header { tagline = ##f }
\score { \new Staff { \clef treble \key bes \major \time 3/4
  bes'4 a'4 b'4 | ees''4. d''8 r4 | ges''4 f''8 r8 e''4 \break
  r4 r8 c''8 d''4 | bes'2. | r2. \bar "|." }
  \layout { \context { \Score \remove "Bar_number_engraver" } } }
