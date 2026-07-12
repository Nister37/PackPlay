pipeline {
  agent { label 'packplay-agent' }

  options {
    disableConcurrentBuilds()
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '10'))
    skipDefaultCheckout(true)
  }

  environment {
    CI = 'true'
    NX_DAEMON = 'false'
    DATABASE_URL = 'mysql://packplay_ci:packplay_ci@mysql-ci:3306/packplay_ci'
    REDIS_HOST = 'redis-ci'
    REDIS_PORT = '6379'
    REDIS_PASSWORD = 'packplay_ci'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install') {
      steps {
        sh 'corepack enable'
        sh 'npm ci --no-audit --no-fund'
      }
    }

    stage('Generate Prisma client') {
      steps {
        sh 'npx prisma generate'
      }
    }

    stage('Unit tests') {
      steps {
        sh 'npx nx run-many --target=test --all --ci --coverage --reporters=default --reporters=jest-junit'
      }
      post {
        always {
          junit testResults: '**/test-results/**/*.xml', allowEmptyResults: true
          archiveArtifacts artifacts: '**/coverage/**', allowEmptyArchive: true
        }
      }
    }

    stage('Full pipeline (main only)') {
      when {
        branch 'main'
      }
      stages {
        stage('Verify full-pipeline contract') {
          steps {
            sh '''
              missing=0
              for target in openapi integration e2e; do
                projects="$(npx nx show projects --with-target="$target")"
                if [ -z "$projects" ]; then
                  echo "Required main-branch target is missing: $target" >&2
                  missing=1
                fi
              done
              exit "$missing"
            '''
          }
        }
        stage('Lint') {
          steps {
            sh 'npx nx run-many --target=lint --all'
          }
        }
        stage('Build') {
          steps {
            sh 'npx nx run-many --target=build --all'
          }
        }
        stage('Prisma schema') {
          steps {
            sh 'npx prisma validate'
            sh 'npx prisma db push --skip-generate --accept-data-loss'
          }
        }
        stage('OpenAPI schema') {
          steps {
            sh 'npx nx run-many --target=openapi --all --configuration=ci'
          }
        }
        stage('Integration tests') {
          steps {
            sh 'npx nx run-many --target=integration --all --configuration=ci'
          }
        }
        stage('End-to-end tests') {
          steps {
            sh 'npx nx run-many --target=e2e --all --configuration=ci'
          }
        }
      }
    }
  }

  post {
    success {
      echo "${env.BRANCH_NAME == 'main' ? 'Full' : 'Unit-test'} pipeline passed."
    }
    unsuccessful {
      echo 'Inspect the failed stage and console output. This result is informational and does not block merging.'
    }
    cleanup {
      deleteDir()
    }
  }
}
