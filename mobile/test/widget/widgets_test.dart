import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omlu/widgets/omlu_avatar.dart';
import 'package:omlu/widgets/omlu_button.dart';
import 'package:omlu/widgets/omlu_empty_state.dart';
import 'package:omlu/widgets/omlu_text_field.dart';

void main() {
  group('Widget Tests', () {
    testWidgets('OmluButton renders text and triggers callback', (tester) async {
      var tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OmluButton(
              text: 'Save Memory',
              onPressed: () {
                tapped = true;
              },
            ),
          ),
        ),
      );

      expect(find.text('Save Memory'), findsOneWidget);
      await tester.tap(find.text('Save Memory'));
      await tester.pumpAndSettle();
      expect(tapped, isTrue);
    });

    testWidgets('OmluButton shows loading spinner when isLoading is true', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OmluButton(
              text: 'Save Memory',
              isLoading: true,
              onPressed: () {},
            ),
          ),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Save Memory'), findsOneWidget);
    });

    testWidgets('OmluEmptyState displays title, subtitle, and CTA button', (tester) async {
      var ctaPressed = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OmluEmptyState(
              icon: Icons.photo_library_outlined,
              title: 'No memories yet',
              subtitle: 'Capture moments to share with your Space.',
              primaryActionText: 'Capture Moment',
              onPrimaryAction: () {
                ctaPressed = true;
              },
            ),
          ),
        ),
      );

      expect(find.text('No memories yet'), findsOneWidget);
      expect(find.text('Capture moments to share with your Space.'), findsOneWidget);
      expect(find.text('Capture Moment'), findsOneWidget);

      await tester.tap(find.text('Capture Moment'));
      await tester.pumpAndSettle();
      expect(ctaPressed, isTrue);
    });

    testWidgets('OmluAvatar shows initials when url is null', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: OmluAvatar(
              displayName: 'Jane Doe',
              size: OmluAvatarSize.lg,
            ),
          ),
        ),
      );

      expect(find.text('JD'), findsOneWidget);
    });

    testWidgets('OmluTextField accepts input and displays label', (tester) async {
      final controller = TextEditingController();

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OmluTextField(
              controller: controller,
              label: 'Space Name',
              hint: 'e.g. Summer Roadtrip',
            ),
          ),
        ),
      );

      expect(find.text('Space Name'), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'Hostel 4');
      expect(controller.text, equals('Hostel 4'));
    });
  });
}
