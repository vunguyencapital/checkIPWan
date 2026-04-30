# build 
docker build -t nodejs-checkip .

# run docker
docker run -d --name check-wan-ip -p 13000:13000 nodejs-checkip

# dùng scripts để xóa và build lại image cũ
./build_and_cleanup.sh


# gitlab
git remote set-url origin git@gitlab.com:vunguyen-dev/gitlab-cicd/nodejs.git

