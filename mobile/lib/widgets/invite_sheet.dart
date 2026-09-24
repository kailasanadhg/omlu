import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:omlu/core/design_system.dart';
import 'package:omlu/core/models.dart';
import 'package:qr_flutter/qr_flutter.dart';

class InviteSheet extends StatelessWidget {
  final Space space;

  const InviteSheet({super.key, required this.space});

  @override
  Widget build(BuildContext context) {
    // Construct invite URL using a standard format
    // Replace with actual domain when available
    final inviteUrl = 'https://omlu.app/join/${space.inviteCode}';

    return Container(
      decoration: const BoxDecoration(
        color: OmluColors.background,
        borderRadius: BorderRadius.vertical(top: Radius.circular(OmluRadii.xl)),
      ),
      padding: EdgeInsets.only(
        left: OmluSpacing.xl,
        right: OmluSpacing.xl,
        top: OmluSpacing.md,
        bottom: MediaQuery.of(context).padding.bottom + OmluSpacing.xl,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: OmluColors.tertiary,
              borderRadius: BorderRadius.circular(OmluRadii.full),
            ),
          ),
          const SizedBox(height: OmluSpacing.xl),
          
          Text(
            'Invite to ${space.name}',
            style: OmluTypography.pageTitle,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: OmluSpacing.xs),
          const Text(
            'Anyone with this link or QR code can join the space.',
            style: OmluTypography.bodySmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: OmluSpacing.xl),
          
          // QR Code
          Container(
            padding: const EdgeInsets.all(OmluSpacing.md),
            decoration: BoxDecoration(
              color: OmluColors.surface,
              borderRadius: BorderRadius.circular(OmluRadii.md),
              border: Border.all(color: OmluColors.border),
            ),
            child: QrImageView(
              data: inviteUrl,
              version: QrVersions.auto,
              size: 200.0,
              backgroundColor: OmluColors.surface,
              eyeStyle: const QrEyeStyle(
                eyeShape: QrEyeShape.square,
                color: OmluColors.primary,
              ),
              dataModuleStyle: const QrDataModuleStyle(
                dataModuleShape: QrDataModuleShape.square,
                color: OmluColors.primary,
              ),
            ),
          ),
          const SizedBox(height: OmluSpacing.xl),
          
          // Action Buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: inviteUrl));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Invite link copied to clipboard')),
                    );
                    Navigator.pop(context);
                  },
                  icon: const Icon(Icons.copy, size: 20),
                  label: const Text('Copy Link', style: OmluTypography.button),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: OmluColors.primary,
                    side: const BorderSide(color: OmluColors.border),
                    padding: const EdgeInsets.symmetric(vertical: OmluSpacing.sm),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(OmluRadii.full),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: OmluSpacing.md),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    Clipboard.setData(
                      ClipboardData(
                        text: 'Join my space "${space.name}" on OMLU!\n\n$inviteUrl',
                      ),
                    );
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Invite copied to clipboard')),
                    );
                    Navigator.pop(context);
                  },
                  icon: const Icon(Icons.share, size: 20),
                  label: const Text('Share', style: OmluTypography.button),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: OmluColors.primary,
                    foregroundColor: OmluColors.textInverse,
                    padding: const EdgeInsets.symmetric(vertical: OmluSpacing.sm),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(OmluRadii.full),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
