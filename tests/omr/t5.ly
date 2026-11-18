\version "2.24.0"
#(set-global-staff-size 24)
\paper { indent = 0  paper-width = 190\mm  paper-height = 120\mm  top-margin=10\mm bottom-margin=10\mm left-margin=10\mm right-margin=10\mm }
\header { tagline = ##f }
\score { \new Staff { \clef alto \key g \major \time 4/4
  g'4\mf a'4\< b'4 cis''4\! | c''4\f \upbow d''4 \downbow e''4 fis''4\> | f''4\p g''2 \downbow r4 | g'2\> fis'4\! r8 g'8\pp \bar "|." }
  \layout { \context { \Score \remove "Bar_number_engraver" } } }
