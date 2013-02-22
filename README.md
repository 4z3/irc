# integrated retiolum control

## getting started

    git clone this repository $somewhere && cd into it
    npm install

### create retiolum user

    groupadd -g 1027 -r retiolum
    useradd -u 1027 -g 1027 -m -r -f -1 -d /opt/retiolum -k /var/empty retiolum

### install privileged tincd executable for retiolum user

    mkdir   -m 750            /opt/retiolum/sbin
    chgrp   retiolum          /opt/retiolum/sbin
    cp      /usr/sbin/tincd   /opt/retiolum/sbin/tincd
    chmod   710               /opt/retiolum/sbin/tincd
    chgrp   retiolum          /opt/retiolum/sbin/tincd
    setcap  cap_net_admin=ep  /opt/retiolum/sbin/tincd

  to bind to port 655 use `setcap cap_net_admin,cap_net_bind_service=ep`

### populate /opt/retiolum

    su - retiolum

    mkdir run
    mkdir etc
    cp -r /etc/tinc/retiolum/hosts etc/hosts
    cat > etc/tinc.conf <<EOF
    Name = nomic2
    Interface = retiolum-nomic2
    Port = 1665
    ConnectTo = nomic
    EOF
    sbin/tincd --config=etc --pidfile=run/pid --generate-keys

### link system's and retiolum's tincd configuration

    cp /opt/retiolum/etc/hosts/nomic2 /etc/tinc/retiolum/hosts/

    su - retiolum

    echo 'Address = 127.0.0.1' >> etc/hosts/nomic

### run retiolum control

    su - retiolum

    node $somewhere

### keep etc/hosts up-to-date with `parts/github_post_receive.js`

    su - retiolum

    mkdir src
    cd src
    git init
    git remote add -f github https://github.com/krebscode/painload
    git config core.sparsecheckout true
    echo retiolum/hosts > .git/info/sparse-checkout
    git pull github master
    cd ..

  if there is already an `etc/hosts` directory, remove it

    rm -fR etc/hosts

  link the repository's host configuration directory to etc/

    ln -s ../src/retiolum/hosts etc/

### parts/services.js setup

    su - retiolum
    ssh-keygen -f etc/id_rsa  # passphrase is currently unsupported

### requirements

  `parts/informer.js` requires [socat](http://www.dest-unreach.org/socat/)
