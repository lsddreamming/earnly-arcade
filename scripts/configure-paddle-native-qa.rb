require 'xcodeproj'
require 'fileutils'

# Adds UI tests only to the generated simulator project, never the App Store archive.
project = Xcodeproj::Project.open('ios/App/App.xcodeproj')
app = project.targets.find { |target| target.name == 'App' }
raise 'Generated App target not found' unless app
target = project.new_target(:ui_test_bundle, 'PaddleRallyNative', :ios, '15.0')
target.add_dependency(app)
FileUtils.mkdir_p('ios/App/PaddleRallyNative')
FileUtils.cp('scripts/PaddleRallyNative.swift', 'ios/App/PaddleRallyNative/PaddleRallyNative.swift')
group = project.main_group.new_group('PaddleRallyNative', 'PaddleRallyNative')
target.source_build_phase.add_file_reference(group.new_file('PaddleRallyNative.swift'))
target.build_configurations.each do |config|
  config.build_settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.earnly.arcade.PaddleRallyNative'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['TEST_TARGET_NAME'] = 'App'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
end
project.root_object.attributes['TargetAttributes'] ||= {}
project.root_object.attributes['TargetAttributes'][target.uuid] = { 'TestTargetID' => app.uuid }
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_build_target(target)
scheme.set_launch_target(app)
scheme.add_test_target(target)
scheme.save_as('ios/App/App.xcodeproj', 'PaddleRallyNative', true)
