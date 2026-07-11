pipeline {
  agent { label 'packplay-agent' }

  options {
    disableConcurrentBuilds(abortPrevious: true)
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '10'))
    skipDefaultCheckout(true)
  }

  environment {
    CI = 'true'
    NX_DAEMON = 'false'
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
        stage('Integration tests') {
          steps {
            sh '''
              projects="$(npx nx show projects --with-target=integration)"
              if [ -n "$projects" ]; then
                npx nx run-many --target=integration --projects="$projects" --configuration=ci
              else
                echo 'No integration target is defined yet; skipping.'
              fi
            '''
          }
        }
        stage('End-to-end tests') {
          steps {
            sh '''
              projects="$(npx nx show projects --with-target=e2e)"
              if [ -n "$projects" ]; then
                npx nx run-many --target=e2e --projects="$projects" --configuration=ci
              else
                echo 'No e2e target is defined yet; skipping.'
              fi
            '''
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
