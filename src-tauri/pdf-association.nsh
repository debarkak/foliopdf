!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr HKCU "Software\Classes\FolioPDF.PDF" "" "PDF document"
  WriteRegStr HKCU "Software\Classes\FolioPDF.PDF\DefaultIcon" "" '$INSTDIR\foliopdf.exe,0'
  WriteRegStr HKCU "Software\Classes\FolioPDF.PDF\shell\open\command" "" '$"$INSTDIR\foliopdf.exe$" $"%1$"'
  WriteRegStr HKCU "Software\Classes\.pdf\OpenWithProgids" "FolioPDF.PDF" ""
  WriteRegStr HKCU "Software\FolioPDF\Capabilities" "ApplicationName" "FolioPDF"
  WriteRegStr HKCU "Software\FolioPDF\Capabilities" "ApplicationDescription" "A lightweight PDF reader"
  WriteRegStr HKCU "Software\FolioPDF\Capabilities\FileAssociations" ".pdf" "FolioPDF.PDF"
  WriteRegStr HKCU "Software\RegisteredApplications" "FolioPDF" "Software\FolioPDF\Capabilities"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegValue HKCU "Software\RegisteredApplications" "FolioPDF"
  DeleteRegKey HKCU "Software\FolioPDF\Capabilities"
  DeleteRegValue HKCU "Software\Classes\.pdf\OpenWithProgids" "FolioPDF.PDF"
  DeleteRegKey HKCU "Software\Classes\FolioPDF.PDF"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
