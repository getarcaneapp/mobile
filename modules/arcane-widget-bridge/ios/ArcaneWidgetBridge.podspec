Pod::Spec.new do |s|
  s.name           = 'ArcaneWidgetBridge'
  s.version        = '1.0.0'
  s.summary        = 'Home Screen widget snapshots and Live Activities for Arcane.'
  s.description    = s.summary
  s.license        = 'MIT'
  s.author         = 'Arcane'
  s.homepage       = 'https://getarcane.app'
  s.platforms      = { :ios => '18.0' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.frameworks     = 'ActivityKit', 'WidgetKit'

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
