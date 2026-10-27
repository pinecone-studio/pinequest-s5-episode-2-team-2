# Manual fallback for the observed Xcode 27.1 ExpoSQLite dependency-scan failure.
# Run after prebuild/pod install; generated iOS projects remain outside git.
require 'xcodeproj'

ios_root = ARGV[0] || File.expand_path('../apps/mobile/ios', __dir__)
projects = [['Pods/Pods.xcodeproj', 'ExpoSQLite'], ['mobile.xcodeproj', 'mobile']].map do |path, name|
  project_path = File.join(ios_root, path)
  abort "Missing #{project_path}; run iOS prebuild and pod install first." unless File.directory?(project_path)
  project = Xcodeproj::Project.open(project_path)
  target = project.targets.find { |candidate| candidate.name == name }
  abort "Missing target #{name} in #{project_path}" unless target
  [project, target]
end

projects.each do |project, target|
  changed = false
  target.build_configurations.each do |config|
    next if config.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] == 'NO'
    config.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO'
    changed = true
  end
  project.save if changed
  puts "#{target.name}: SWIFT_ENABLE_EXPLICIT_MODULES=NO (#{changed ? 'updated' : 'unchanged'})"
end
