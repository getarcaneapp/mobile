Pod::Spec.new do |s|
  s.name           = 'ArcaneSwiftUIExtras'
  s.version        = '1.0.0'
  s.summary        = 'Extra SwiftUI view modifiers for @expo/ui trees (symbolRenderingMode).'
  s.description    = s.summary
  s.license        = 'MIT'
  s.author         = 'Arcane'
  s.homepage       = 'https://getarcane.app'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'ExpoUI'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
