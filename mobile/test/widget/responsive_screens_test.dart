import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:omlu/core/api_client.dart';
import 'package:omlu/core/auth_provider.dart';
import 'package:omlu/core/models.dart';
import 'package:omlu/screens/login_screen.dart';
import 'package:omlu/screens/signup_screen.dart';
import 'package:omlu/screens/create_space_screen.dart';
import 'package:omlu/widgets/space_circles.dart';
import 'package:omlu/widgets/omlu_empty_state.dart';

void main() {
  const viewports = <String, Size>{
    'Compact Phone (320x568)': Size(320, 568),
    'Standard Phone (375x812)': Size(375, 812),
    'Large Android (412x915)': Size(412, 915),
    'Pro Max (430x932)': Size(430, 932),
    'Tablet Portrait (768x1024)': Size(768, 1024),
    'Phone Landscape (812x375)': Size(812, 375),
  };

  group('Responsive Layout Tests - No RenderFlex Overflows', () {
    for (final entry in viewports.entries) {
      final name = entry.key;
      final size = entry.value;

      testWidgets('LoginScreen renders cleanly on $name', (tester) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        final api = ApiClient(baseUrl: 'http://localhost:8000/api/v1');
        final auth = AuthProvider(api: api);

        await tester.pumpWidget(
          MultiProvider(
            providers: [
              ChangeNotifierProvider<AuthProvider>.value(value: auth),
              Provider<ApiClient>.value(value: api),
            ],
            child: const MaterialApp(
              home: LoginScreen(),
            ),
          ),
        );

        expect(tester.takeException(), isNull);
        expect(find.text('omlu'), findsOneWidget);
        expect(find.text('Log In'), findsOneWidget);
      });

      testWidgets('SignupScreen renders cleanly on $name', (tester) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        final api = ApiClient(baseUrl: 'http://localhost:8000/api/v1');
        final auth = AuthProvider(api: api);

        await tester.pumpWidget(
          MultiProvider(
            providers: [
              ChangeNotifierProvider<AuthProvider>.value(value: auth),
              Provider<ApiClient>.value(value: api),
            ],
            child: const MaterialApp(
              home: SignupScreen(),
            ),
          ),
        );

        expect(tester.takeException(), isNull);
        expect(find.text('Create Account'), findsOneWidget);
      });

      testWidgets('CreateSpaceScreen renders cleanly on $name', (tester) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        final api = ApiClient(baseUrl: 'http://localhost:8000/api/v1');

        await tester.pumpWidget(
          Provider<ApiClient>.value(
            value: api,
            child: const MaterialApp(
              home: CreateSpaceScreen(),
            ),
          ),
        );

        expect(tester.takeException(), isNull);
        expect(find.text('Create Space'), findsWidgets);
      });

      testWidgets('SpaceCircles renders cleanly on $name', (tester) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        final spaces = [
          const Space(
            id: 's-1',
            name: 'Family Memories',
            ownerId: 'u-1',
            inviteCode: 'CODE1',
            membersCount: 4,
            memoriesCount: 12,
            isOwner: true,
            isMember: true,
            createdAt: '2026-09-24T00:00:00Z',
          ),
          const Space(
            id: 's-2',
            name: 'College Squad',
            ownerId: 'u-2',
            inviteCode: 'CODE2',
            membersCount: 8,
            memoriesCount: 45,
            isOwner: false,
            isMember: true,
            createdAt: '2026-09-24T00:00:00Z',
          ),
        ];

        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: SpaceCircles(
                spaces: spaces,
                onCreateSpace: () {},
                onSpaceTap: (_) {},
              ),
            ),
          ),
        );

        expect(tester.takeException(), isNull);
        expect(find.text('+ Space'), findsOneWidget);
        expect(find.text('Family Memories'), findsOneWidget);
      });

      testWidgets('OmluEmptyState renders cleanly on $name', (tester) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: OmluEmptyState(
                icon: Icons.photo_library_outlined,
                title: 'No memories here yet',
                subtitle: 'Contribute a moment to this private Space.',
                primaryActionText: 'Capture Moment',
                onPrimaryAction: () {},
                secondaryActionText: 'Invite Members',
                onSecondaryAction: () {},
              ),
            ),
          ),
        );

        expect(tester.takeException(), isNull);
        expect(find.text('No memories here yet'), findsOneWidget);
        expect(find.text('Capture Moment'), findsOneWidget);
      });
    }
  });
}
