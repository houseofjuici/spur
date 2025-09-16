/**
 * License Validator for Open Source Component Integration
 * Validates license compatibility and compliance requirements
 */

export interface LicenseInfo {
  isValid: boolean
  licenseType: string
  restrictions: string[]
  attributionRequired: boolean
  shareAlike: boolean
  commercialUse: boolean
  modificationsAllowed: boolean
}

export interface CompatibilityResult {
  compatible: boolean
  conflicts: string[]
  requirements: string[]
  recommendations: string[]
}

export class LicenseValidator {
  private readonly compatibleLicenses = new Set([
    'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Unlicense'
  ])

  private readonly restrictedLicenses = new Set([
    'GPL-3.0', 'GPL-2.0', 'LGPL-3.0', 'AGPL-3.0', 'MPL-2.0'
  ])

  private readonly incompatibleLicenses = new Set([
    'PROPRIETARY', 'COMMERCIAL', 'CUSTOM', 'ALL-RIGHTS-RESERVED'
  ])

  /**
   * Validate a license against Spur's requirements
   */
  validateLicense(licenseType: string, projectName: string): LicenseInfo {
    const normalizedLicense = this.normalizeLicense(licenseType)

    const baseInfo: LicenseInfo = {
      isValid: false,
      licenseType: normalizedLicense,
      restrictions: [],
      attributionRequired: false,
      shareAlike: false,
      commercialUse: true,
      modificationsAllowed: true
    }

    switch (normalizedLicense) {
      case 'MIT':
        return {
          ...baseInfo,
          isValid: true,
          attributionRequired: true
        }

      case 'Apache-2.0':
        return {
          ...baseInfo,
          isValid: true,
          attributionRequired: true,
          restrictions: ['patent-grant', 'notice-retention']
        }

      case 'BSD-2-Clause':
      case 'BSD-3-Clause':
        return {
          ...baseInfo,
          isValid: true,
          attributionRequired: true,
          restrictions: ['no-endorsement']
        }

      case 'ISC':
        return {
          ...baseInfo,
          isValid: true,
          attributionRequired: true
        }

      case 'Unlicense':
        return {
          ...baseInfo,
          isValid: true,
          attributionRequired: false
        }

      case 'GPL-3.0':
      case 'GPL-2.0':
        return {
          ...baseInfo,
          isValid: true,
          shareAlike: true,
          restrictions: ['copyleft', 'source-available'],
          attributionRequired: true
        }

      case 'LGPL-3.0':
      case 'MPL-2.0':
        return {
          ...baseInfo,
          isValid: true,
          shareAlike: true,
          restrictions: ['file-level-copyleft'],
          attributionRequired: true
        }

      case 'AGPL-3.0':
        return {
          ...baseInfo,
          isValid: true,
          shareAlike: true,
          restrictions: ['network-copyleft', 'source-available'],
          attributionRequired: true
        }

      default:
        if (this.compatibleLicenses.has(normalizedLicense)) {
          return {
            ...baseInfo,
            isValid: true,
            attributionRequired: true
          }
        }

        return {
          ...baseInfo,
          isValid: false,
          restrictions: ['unknown-license-type'],
          commercialUse: false,
          modificationsAllowed: false
        }
    }
  }

  /**
   * Check license compatibility between Spur and external component
   */
  checkCompatibility(
    componentLicense: string,
    spurLicense: string = 'MIT'
  ): CompatibilityResult {
    const componentInfo = this.validateLicense(componentLicense, 'component')
    const spurInfo = this.validateLicense(spurLicense, 'spur')

    const conflicts: string[] = []
    const requirements: string[] = []
    const recommendations: string[] = []

    // Check for direct incompatibilities
    if (this.incompatibleLicenses.has(this.normalizeLicense(componentLicense))) {
      conflicts.push('Component has incompatible license type')
      return {
        compatible: false,
        conflicts,
        requirements,
        recommendations
      }
    }

    // Check for share-alike requirements
    if (componentInfo.shareAlike && !spurInfo.shareAlike) {
      conflicts.push('Component requires share-alike but Spur does not provide it')
      requirements.push('Must publish Spur source code when distributed')
    }

    // Check attribution requirements
    if (componentInfo.attributionRequired) {
      requirements.push(`Must include attribution for ${componentLicense}`)
    }

    // Check for commercial use restrictions
    if (!componentInfo.commercialUse) {
      conflicts.push('Component cannot be used in commercial applications')
    }

    // Check modification restrictions
    if (!componentInfo.modificationsAllowed) {
      conflicts.push('Component cannot be modified')
    }

    // Generate recommendations based on license type
    if (componentInfo.licenseType.includes('GPL')) {
      recommendations.push('Consider isolating GPL components in separate modules')
      recommendations.push('Ensure proper separation of GPL and proprietary code')
    }

    if (componentInfo.licenseType === 'AGPL-3.0') {
      requirements.push('Must provide source code for network deployments')
      recommendations.push('Consider alternative components for SaaS applications')
    }

    return {
      compatible: conflicts.length === 0,
      conflicts,
      requirements,
      recommendations
    }
  }

  /**
   * Generate attribution text for component
   */
  generateAttribution(
    componentName: string,
    version: string,
    license: string,
    repository: string,
    copyright?: string
  ): string {
    const attribution = [
      `${componentName} v${version}`,
      `License: ${license}`,
      `Repository: ${repository}`
    ]

    if (copyright) {
      attribution.push(`Copyright: ${copyright}`)
    }

    return attribution.join('\n  ')
  }

  /**
   * Extract license information from package.json
   */
  extractLicenseFromPackage(packageJson: any): LicenseInfo {
    let licenseType = packageJson.license || 'UNLICENSED'

    // Handle SPDX license expressions
    if (typeof licenseType === 'object' && licenseType.type) {
      licenseType = licenseType.type
    }

    // Handle license arrays
    if (Array.isArray(licenseType)) {
      licenseType = licenseType[0]
    }

    return this.validateLicense(licenseType, packageJson.name || 'unknown')
  }

  /**
   * Normalize license string for consistent comparison
   */
  private normalizeLicense(license: string): string {
    return license
      .toUpperCase()
      .replace(/\s+/g, '-')
      .replace(/^LICENSE-/, '')
      .replace(/-ONLY$/, '')
      .replace(/-OR-LATER$/, '')
  }

  /**
   * Get license requirements for integration
   */
  getIntegrationRequirements(licenseInfo: LicenseInfo): string[] {
    const requirements: string[] = []

    if (licenseInfo.attributionRequired) {
      requirements.push('Include license and copyright notices in documentation')
      requirements.push('Preserve original license text in component')
    }

    if (licenseInfo.shareAlike) {
      requirements.push('Share modifications under same license')
      requirements.push('Provide source code for modifications')
    }

    if (licenseInfo.licenseType.includes('GPL')) {
      requirements.push('Ensure component is in separate, dynamically linked module')
      requirements.push('Provide offer for source code when distributing binaries')
    }

    if (licenseInfo.licenseType === 'AGPL-3.0') {
      requirements.push('Provide source code for network service deployments')
    }

    return requirements
  }

  /**
   * Check if license requires source disclosure
   */
  requiresSourceDisclosure(licenseInfo: LicenseInfo): boolean {
    return licenseInfo.shareAlike || 
           licenseInfo.licenseType.includes('GPL') ||
           licenseInfo.licenseType === 'MPL-2.0'
  }

  /**
   * Validate that extracted code maintains license compliance
   */
  validateExtractedCode(
    originalLicense: LicenseInfo,
    extractedCode: string,
    componentPath: string
  ): boolean {
    // Check if attribution is preserved
    if (originalLicense.attributionRequired) {
      const hasAttribution = extractedCode.toLowerCase().includes('license') ||
                           extractedCode.toLowerCase().includes('copyright') ||
                           extractedCode.toLowerCase().includes('author')

      if (!hasAttribution) {
        console.warn(`Missing attribution in extracted code: ${componentPath}`)
        return false
      }
    }

    // Check for license text preservation
    if (originalLicense.licenseType.includes('GPL')) {
      const hasLicenseText = extractedCode.toLowerCase().includes('general public license') ||
                            extractedCode.toLowerCase().includes('gpl')

      if (!hasLicenseText) {
        console.warn(`Missing license text in GPL component: ${componentPath}`)
        return false
      }
    }

    return true
  }
}